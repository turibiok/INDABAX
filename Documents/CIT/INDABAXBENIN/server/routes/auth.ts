import { Router } from 'express';
import { AccountStatus, ParticipantRole, UserAccount } from '../../src/types';
import { mapUserAccounts, normalizeEmail } from '../../src/lib/sheets';
import { capabilitiesFor } from '../../src/permissions';
import {
  findAccount,
  getAccounts,
  getSheetsConfig,
  isBootstrapAdmin,
  removeAccount,
  replaceAccounts,
  resolvePasswordHash,
  setPasswordHash,
  toPublicAccount,
  upsertAccount,
} from '../store';
import {
  generatePassword,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  validatePassword,
  verifyPassword,
} from '../passwords';
import {
  AuthedRequest,
  clearSessionCookie,
  createSession,
  destroySession,
  getSession,
  requireCapability,
  requireAuth,
  revokeSessionsForEmail,
  setSessionCookie,
  toClientSession,
  updateSessionRole,
  updateSessionsForEmail,
} from '../sessions';
import { readTab, SheetError } from '../sheetsGateway';

export const authRouter = Router();

/** Longueur minimale exigee, exposee pour les messages d'interface. */
export const PASSWORD_MIN_LENGTH = MIN_PASSWORD_LENGTH;

/* ------------------------------------------------------------------ *
 * Limitation des tentatives de connexion
 * ------------------------------------------------------------------ */

const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

const attempts = new Map<string, { count: number; firstAt: number }>();

function attemptKey(ip: string, email: string) {
  return `${ip}|${email}`;
}

function tooManyAttempts(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;

  if (Date.now() - entry.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.delete(key);
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const entry = attempts.get(key);

  if (!entry || Date.now() - entry.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }

  entry.count += 1;
}

function clearAttempts(key: string) {
  attempts.delete(key);
}

/* ------------------------------------------------------------------ *
 * Resolution du role
 * ------------------------------------------------------------------ */

interface Resolution {
  account: UserAccount;
  source: 'sheet' | 'local' | 'bootstrap';
  warning?: string;
  /** Empreinte a utiliser pour verifier le mot de passe saisi. */
  passwordHash?: string;
}

/**
 * Determine le compte et le role d'un email.
 *
 * Ordre : classeur Google Sheet (source de verite), puis table locale du
 * serveur, puis liste ADMIN_EMAILS d'amorcage.
 */
async function resolveAccount(email: string): Promise<Resolution> {
  const config = getSheetsConfig();
  let warning: string | undefined;

  if (config.isLinked && config.masterSheetUrl.trim()) {
    try {
      const table = await readTab(config.usersTab, config);
      const account = mapUserAccounts(table).find(item => item.email === email);
      if (account) {
        return { account, source: 'sheet', passwordHash: await resolvePasswordHash(account) };
      }
    } catch (error: any) {
      // Classeur momentanement illisible : on n'enferme pas les organisateurs
      // dehors, on retombe sur la table locale du serveur en le signalant.
      warning = `Classeur illisible (${error.message}) : rôle appliqué depuis la table locale du serveur.`;
      console.warn('Lecture du classeur impossible à la connexion :', error.message);
    }
  }

  const local = findAccount(email);
  if (local) {
    return { account: local, source: 'local', warning, passwordHash: local.passwordHash };
  }

  if (isBootstrapAdmin(email)) {
    // Le mot de passe d'amorcage vient de la variable ADMIN_PASSWORD : il n'est
    // ni dans le classeur ni dans le fichier d'etat.
    const bootstrapPassword = process.env.ADMIN_PASSWORD || '';

    return {
      account: {
        email,
        name: email.split('@')[0].replace(/[._-]+/g, ' '),
        role: 'super-admin',
        status: 'active',
      },
      source: 'bootstrap',
      passwordHash: bootstrapPassword ? await hashPassword(bootstrapPassword) : undefined,
      warning: warning || "Connexion via la liste ADMIN_EMAILS du serveur : liez un classeur pour gérer les rôles.",
    };
  }

  throw new SheetError(
    "Cet email n'est pas enregistré. Demandez à un organisateur de vous ajouter dans la base des comptes.",
    404,
    'not_found',
  );
}

/* ------------------------------------------------------------------ *
 * POST /api/auth/login
 * ------------------------------------------------------------------ */

authRouter.post('/login', async (req, res) => {
  const email = normalizeEmail(typeof req.body?.email === 'string' ? req.body.email : '');
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const ip = req.ip || 'inconnu';
  const key = attemptKey(ip, email);

  try {
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Adresse email invalide.', reason: 'invalid_email' });
    }

    if (tooManyAttempts(key)) {
      return res.status(429).json({
        error: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
        reason: 'rate_limited',
      });
    }

    if (!password) {
      return res.status(400).json({ error: 'Le mot de passe est requis.', reason: 'password_required' });
    }

    const { account, source, warning, passwordHash } = await resolveAccount(email);

    if (account.status === 'suspended') {
      recordFailure(key);
      return res.status(403).json({ error: "Ce compte a été suspendu par l'administrateur.", reason: 'suspended' });
    }

    // Aucun mot de passe n'est defini pour ce compte : personne ne doit pouvoir
    // entrer, sinon un email connu suffirait.
    if (!passwordHash) {
      return res.status(409).json({
        error:
          source === 'bootstrap'
            ? "Aucun mot de passe d'amorçage : renseignez ADMIN_PASSWORD dans le fichier .env du serveur."
            : "Aucun mot de passe n'est défini pour ce compte. Demandez à un organisateur de vous en attribuer un.",
        reason: 'no_password',
      });
    }

    if (!(await verifyPassword(password, passwordHash))) {
      recordFailure(key);
      return res.status(401).json({ error: 'Mot de passe incorrect.', reason: 'bad_password' });
    }

    clearAttempts(key);

    // Le compte resolu depuis le classeur alimente la table locale, qui sert
    // de repli si le classeur devient momentanement illisible.
    if (source === 'sheet') {
      upsertAccount({
        email: account.email,
        name: account.name,
        role: account.role,
        status: account.status,
        passwordHash,
        institution: account.institution,
        position: account.position,
        ticketNumber: account.ticketNumber,
        avatarUrl: account.avatarUrl,
        assignedBy: 'Synchronisation classeur',
      });
    }

    const session = createSession({
      email: account.email,
      name: account.name,
      role: account.role,
      status: account.status,
      source,
    });

    setSessionCookie(res, session);

    res.json({
      session: toClientSession(session),
      capabilities: capabilitiesFor(session.role),
      profile: toPublicAccount(account),
      warning,
    });
  } catch (error: any) {
    if (error instanceof SheetError && error.reason === 'not_found') {
      recordFailure(key);
    }

    const status = error instanceof SheetError ? error.status : 500;
    res.status(status).json({
      error: error.message || 'Authentification impossible.',
      reason: error instanceof SheetError ? error.reason : 'unknown',
    });
  }
});

/* ------------------------------------------------------------------ *
 * GET /api/auth/session — etat courant, appele au demarrage du client
 * ------------------------------------------------------------------ */

/**
 * Sonde d'etat, appelee au demarrage du client.
 *
 * Elle repond 200 avec `session: null` quand personne n'est connecte : ce
 * n'est pas une ressource protegee mais une question, et un 401 remplirait
 * inutilement la console du navigateur d'erreurs.
 */
authRouter.get('/session', (req, res) => {
  const session = getSession(req);

  if (!session) {
    return res.json({ session: null });
  }

  const account = findAccount(session.email);

  res.json({
    session: toClientSession(session),
    capabilities: capabilitiesFor(session.role),
    profile: account ? toPublicAccount(account) : null,
  });
});

/* ------------------------------------------------------------------ *
 * POST /api/auth/logout
 * ------------------------------------------------------------------ */

authRouter.post('/logout', (req, res) => {
  destroySession(req);
  clearSessionCookie(res);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * POST /api/auth/refresh — relit le role dans le classeur
 * ------------------------------------------------------------------ */

authRouter.post('/refresh', requireAuth, async (req: AuthedRequest, res) => {
  const session = req.session!;

  try {
    const { account, source } = await resolveAccount(session.email);

    if (account.status === 'suspended') {
      revokeSessionsForEmail(session.email);
      clearSessionCookie(res);
      return res.status(403).json({ error: 'Ce compte vient d’être suspendu.', reason: 'suspended' });
    }

    const changed = account.role !== session.role || account.status !== session.status;
    updateSessionRole(session.id, {
      role: account.role,
      status: account.status,
      name: account.name,
      source,
    });

    res.json({
      session: toClientSession({ ...session, role: account.role, status: account.status, name: account.name, source }),
      capabilities: capabilitiesFor(account.role),
      changed,
    });
  } catch (error: any) {
    const status = error instanceof SheetError ? error.status : 500;
    res.status(status).json({ error: error.message, reason: error instanceof SheetError ? error.reason : 'unknown' });
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/auth/password — changement de son propre mot de passe
 * ------------------------------------------------------------------ */

authRouter.post('/password', requireAuth, async (req: AuthedRequest, res) => {
  const session = req.session!;
  const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  const invalid = validatePassword(next);
  if (invalid) {
    return res.status(400).json({ error: invalid, reason: 'weak_password' });
  }

  const account = findAccount(session.email);
  if (!account) {
    return res.status(404).json({
      error: "Votre compte n'est pas enregistré sur ce serveur : le mot de passe ne peut pas y être changé.",
      reason: 'not_found',
    });
  }

  // Le mot de passe actuel est exige : un cookie vole ne doit pas suffire a
  // verrouiller definitivement le compte de quelqu'un d'autre.
  if (!account.passwordHash || !(await verifyPassword(current, account.passwordHash))) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.', reason: 'bad_password' });
  }

  if (await verifyPassword(next, account.passwordHash)) {
    return res.status(400).json({
      error: "Le nouveau mot de passe est identique à l'actuel.",
      reason: 'unchanged',
    });
  }

  setPasswordHash(session.email, await hashPassword(next));

  res.json({
    ok: true,
    message: 'Mot de passe modifié. Il remplace celui du classeur pour vos prochaines connexions.',
  });
});

/* ------------------------------------------------------------------ *
 * Gestion des comptes — reservee a canManageRoles
 * ------------------------------------------------------------------ */

authRouter.get('/accounts', requireCapability('canManageRoles'), (_req, res) => {
  res.json({ accounts: getAccounts().map(toPublicAccount) });
});

authRouter.post('/accounts', requireCapability('canManageRoles'), async (req: AuthedRequest, res) => {
  const email = normalizeEmail(typeof req.body?.email === 'string' ? req.body.email : '');
  const role = req.body?.role as ParticipantRole;
  const status = req.body?.status as AccountStatus | undefined;

  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  const validRoles: ParticipantRole[] = ['attendee', 'speaker', 'volunteer', 'organizer', 'sponsor', 'super-admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rôle inconnu.' });
  }

  // Mot de passe : fourni par l'admin, ou genere si demande. Il n'est renvoye
  // en clair qu'une seule fois, pour que l'admin puisse le transmettre.
  const wantsGenerated = req.body?.generatePassword === true;
  const providedPassword = typeof req.body?.password === 'string' ? req.body.password : '';

  let plainPassword: string | undefined;
  if (wantsGenerated) {
    plainPassword = generatePassword();
  } else if (providedPassword) {
    const invalid = validatePassword(providedPassword);
    if (invalid) {
      return res.status(400).json({ error: invalid, reason: 'weak_password' });
    }
    plainPassword = providedPassword;
  }

  const account = upsertAccount({
    email,
    role,
    status,
    name: typeof req.body?.name === 'string' ? req.body.name : undefined,
    passwordHash: plainPassword ? await hashPassword(plainPassword) : undefined,
    institution: typeof req.body?.institution === 'string' ? req.body.institution : undefined,
    position: typeof req.body?.position === 'string' ? req.body.position : undefined,
    assignedBy: req.session!.name,
  });

  // Les sessions ouvertes de cet email suivent immediatement le nouveau role.
  const touched = updateSessionsForEmail(email, { role: account.role, status: account.status });

  // Un mot de passe remplace ferme les sessions ouvertes du compte concerne,
  // sauf s'il s'agit de l'admin lui-meme.
  if (plainPassword && email !== req.session!.email) {
    revokeSessionsForEmail(email);
  }

  res.json({
    account: toPublicAccount(account),
    sessionsUpdated: touched,
    // Transmis une seule fois : le serveur n'en garde que l'empreinte.
    generatedPassword: wantsGenerated ? plainPassword : undefined,
    passwordChanged: Boolean(plainPassword),
  });
});

authRouter.delete('/accounts/:email', requireCapability('canManageRoles'), (req: AuthedRequest, res) => {
  const email = normalizeEmail(req.params.email);

  if (email === req.session!.email) {
    return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre compte.' });
  }

  const removed = removeAccount(email);
  if (removed) revokeSessionsForEmail(email);

  res.json({ removed });
});

/** Recharge la table locale depuis l'onglet des comptes du classeur. */
authRouter.post('/accounts/reload', requireCapability('canManageRoles'), async (_req, res) => {
  try {
    const config = getSheetsConfig();
    const table = await readTab(config.usersTab, config);
    const accounts = mapUserAccounts(table);

    if (accounts.length === 0) {
      return res.status(422).json({
        error:
          `Aucune colonne « Email » exploitable dans l'onglet « ${config.usersTab} ». ` +
          `Vérifiez l'orthographe exacte du nom de l'onglet, puis ses colonnes. ` +
          `Colonnes lues : ${table.headers.filter(Boolean).join(', ') || 'aucune'}.`,
        reason: 'no_accounts',
      });
    }

    await replaceAccounts(accounts);

    // Les roles fraichement lus s'appliquent aux sessions deja ouvertes.
    let sessionsUpdated = 0;
    for (const account of accounts) {
      sessionsUpdated += updateSessionsForEmail(account.email, {
        role: account.role,
        status: account.status,
      });
    }

    res.json({ count: accounts.length, sessionsUpdated });
  } catch (error: any) {
    const status = error instanceof SheetError ? error.status : 500;
    res.status(status).json({ error: error.message, reason: error instanceof SheetError ? error.reason : 'unknown' });
  }
});
