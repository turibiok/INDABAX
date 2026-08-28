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
  toPublicAccount,
  upsertAccount,
} from '../store';
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
      if (account) return { account, source: 'sheet' };
    } catch (error: any) {
      // Classeur momentanement illisible : on n'enferme pas les organisateurs
      // dehors, on retombe sur la table locale du serveur en le signalant.
      warning = `Classeur illisible (${error.message}) : rôle appliqué depuis la table locale du serveur.`;
      console.warn('Lecture du classeur impossible à la connexion :', error.message);
    }
  }

  const local = findAccount(email);
  if (local) {
    return { account: local, source: 'local', warning };
  }

  if (isBootstrapAdmin(email)) {
    return {
      account: {
        email,
        name: email.split('@')[0].replace(/[._-]+/g, ' '),
        role: 'super-admin',
        status: 'active',
      },
      source: 'bootstrap',
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
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
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

    const { account, source, warning } = await resolveAccount(email);

    if (account.status === 'suspended') {
      recordFailure(key);
      return res.status(403).json({ error: "Ce compte a été suspendu par l'administrateur.", reason: 'suspended' });
    }

    // Le code d'acces n'est exige que si la colonne est remplie pour ce compte.
    if (account.accessCode) {
      if (!code) {
        return res.status(401).json({ error: "Un code d'accès est requis pour ce compte.", reason: 'code_required' });
      }

      if (code.toLowerCase() !== account.accessCode.trim().toLowerCase()) {
        recordFailure(key);
        return res.status(401).json({ error: "Code d'accès incorrect.", reason: 'bad_code' });
      }
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
        accessCode: account.accessCode,
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

  const account = upsertAccount({
    email,
    role,
    status,
    name: typeof req.body?.name === 'string' ? req.body.name : undefined,
    accessCode: typeof req.body?.accessCode === 'string' ? req.body.accessCode : undefined,
    institution: typeof req.body?.institution === 'string' ? req.body.institution : undefined,
    position: typeof req.body?.position === 'string' ? req.body.position : undefined,
    assignedBy: req.session!.name,
  });

  // Les sessions ouvertes de cet email suivent immediatement le nouveau role.
  const touched = updateSessionsForEmail(email, { role: account.role, status: account.status });

  res.json({
    account: toPublicAccount(account),
    sessionsUpdated: touched,
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

    replaceAccounts(accounts);

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
