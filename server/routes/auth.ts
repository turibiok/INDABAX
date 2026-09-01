import { Router } from 'express';
import { AccountStatus, ParticipantRole, UserAccount } from '../../src/types';
import { mapUserAccounts, normalizeEmail } from '../../src/lib/sheets';
import { capabilitiesFor } from '../../src/permissions';
import {
  findAccount,
  getAccounts,
  getSheetsConfig,
  isBootstrapAdmin,
  clearPassword,
  removeAccount,
  replaceAccounts,
  resolvePasswordHash,
  setAvatar,
  setPasswordHash,
  updateProfileFields,
  toPublicAccount,
  upsertAccount,
} from '../store';
import { hashPassword, MIN_PASSWORD_LENGTH, validatePassword, verifyPassword } from '../passwords';
import {
  consumeToken,
  isThrottled,
  issueToken,
  noteRequest,
  peekToken,
  revokeTokensFor,
} from '../resetTokens';
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
import {
  expectedHeadersFor,
  isMailerConfigured,
  readTab,
  sendEmail,
  SheetError,
} from '../sheetsGateway';
import { forgetHashInSheet, rememberHashInSheet } from '../profileWriter';
import { checkPhoto, savePhotoInSheet } from '../photos';
import { appliquerPatch, checkProfile, saveProfileInSheet } from '../profileFields';

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
      const table = await readTab(config.profilesTab, config, expectedHeadersFor('profiles'));
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
 * Inscription : l'utilisateur choisit lui-meme son mot de passe
 * ------------------------------------------------------------------ */

/** URL publique de l'application, pour construire le lien de reinitialisation. */
function publicBaseUrl(req: AuthedRequest): string {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  // A defaut, on reconstruit depuis la requete : derriere un reverse proxy,
  // l'en-tete X-Forwarded-Proto porte le schema reel.
  const protocol = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] || req.protocol;
  return `${protocol}://${req.get('host')}`;
}

/**
 * Un email inscriptible est un email deja connu de l'organisation — present
 * dans le classeur ou dans la table du serveur — mais dont le compte n'a pas
 * encore de mot de passe.
 *
 * L'inscription est donc une activation, pas une creation libre : les roles
 * restent decides par l'administrateur, et personne ne s'invite tout seul.
 */
authRouter.post('/register', async (req: AuthedRequest, res) => {
  const email = normalizeEmail(typeof req.body?.email === 'string' ? req.body.email : '');
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Adresse email invalide.', reason: 'invalid_email' });
  }

  const invalid = validatePassword(password);
  if (invalid) {
    return res.status(400).json({ error: invalid, reason: 'weak_password' });
  }

  let resolution: Resolution;
  try {
    resolution = await resolveAccount(email);
  } catch (error: any) {
    const status = error instanceof SheetError ? error.status : 500;
    return res.status(status).json({
      error:
        error instanceof SheetError && error.reason === 'not_found'
          ? "Cet email n'est pas enregistré pour l'événement. Demandez à un organisateur de vous ajouter."
          : error.message,
      reason: error instanceof SheetError ? error.reason : 'unknown',
    });
  }

  const { account, source, passwordHash } = resolution;

  if (account.status === 'suspended') {
    return res.status(403).json({ error: "Ce compte a été suspendu par l'administrateur.", reason: 'suspended' });
  }

  // Un compte qui a deja un mot de passe ne se reinscrit pas : il se connecte,
  // ou passe par l'oubli de mot de passe.
  if (passwordHash) {
    return res.status(409).json({
      error:
        'Ce compte a déjà un mot de passe. Connectez-vous, ou utilisez « Mot de passe oublié » si vous ne le retrouvez pas.',
      reason: 'already_registered',
    });
  }

  const hash = await hashPassword(password);

  upsertAccount({
    email,
    name: account.name,
    role: account.role,
    status: account.status,
    passwordHash: hash,
    institution: account.institution,
    position: account.position,
    ticketNumber: account.ticketNumber,
    avatarUrl: account.avatarUrl,
    assignedBy: source === 'sheet' ? 'Synchronisation classeur' : account.assignedBy,
  });

  revokeTokensFor(email);

  // Le classeur est la seule memoire qui survive a un redemarrage : sans ce
  // retour, la personne devrait se reinscrire a chaque reveil du service.
  const { warning } = await rememberHashInSheet(email, hash);

  const session = createSession({
    email,
    name: account.name,
    role: account.role,
    status: account.status,
    source,
  });

  setSessionCookie(res, session);

  res.json({
    session: toClientSession(session),
    capabilities: capabilitiesFor(session.role),
    profile: toPublicAccount({ ...account, email, passwordHash: hash }),
    warning,
  });
});

/**
 * Indique si un email doit s'inscrire ou se connecter.
 *
 * Utile pour orienter la personne sans lui faire deviner. La reponse ne dit
 * jamais si l'email existe : seulement s'il est activable, ce qui ne renseigne
 * pas un tiers sur la presence d'un compte.
 */
authRouter.post('/status', async (req, res) => {
  const email = normalizeEmail(typeof req.body?.email === 'string' ? req.body.email : '');

  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  try {
    const { passwordHash } = await resolveAccount(email);
    return res.json({ known: true, needsRegistration: !passwordHash });
  } catch {
    return res.json({ known: false, needsRegistration: false });
  }
});

/* ------------------------------------------------------------------ *
 * Mot de passe oublie
 * ------------------------------------------------------------------ */

authRouter.post('/forgot', async (req: AuthedRequest, res) => {
  const email = normalizeEmail(typeof req.body?.email === 'string' ? req.body.email : '');

  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Adresse email invalide.', reason: 'invalid_email' });
  }

  // Reponse volontairement identique dans tous les cas : elle ne doit pas
  // reveler quels emails sont enregistres.
  const neutral = {
    ok: true,
    message:
      'Si cet email est enregistré pour l’événement, un lien de réinitialisation vient de lui être envoyé. ' +
      'Le lien est valable une heure.',
  };

  if (isThrottled(email)) {
    return res.status(429).json({
      error: 'Un lien a déjà été demandé il y a moins d’une minute. Vérifiez votre boîte, spam inclus.',
      reason: 'rate_limited',
    });
  }

  // Avant toute recherche : sans cette trace, le refroidissement ne
  // s'appliquerait qu'aux emails enregistrés, et les distinguerait donc.
  noteRequest(email);

  // De même, l'absence de messagerie est un défaut de configuration global :
  // le dire tout de suite, pour tout email, n'apprend rien sur cet email.
  if (!isMailerConfigured()) {
    return res.status(409).json({
      error:
        "L'envoi d'emails n'est pas configuré pour cette application. " +
        'Demandez à un organisateur de réinitialiser votre mot de passe : ' +
        'vous pourrez alors en choisir un nouveau vous-même.',
      reason: 'no_mailer',
    });
  }

  let account;
  try {
    account = (await resolveAccount(email)).account;
  } catch {
    return res.json(neutral);
  }

  if (account.status === 'suspended') return res.json(neutral);

  const { token, expiresAt } = issueToken(email);
  const link = `${publicBaseUrl(req)}/?reset=${encodeURIComponent(token)}`;

  try {
    await sendEmail({
      to: email,
      subject: 'IndabaX Bénin 2026 — réinitialisation de votre mot de passe',
      body:
        `Bonjour ${account.name},\n\n` +
        `Vous avez demandé à réinitialiser votre mot de passe pour l'application IndabaX Bénin 2026.\n\n` +
        `Ouvrez ce lien pour en choisir un nouveau :\n${link}\n\n` +
        `Ce lien est valable jusqu'à ${expiresAt.toLocaleString('fr-FR')} et ne fonctionne qu'une fois.\n\n` +
        `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.\n\n` +
        `— L'équipe IndabaX Bénin\n`,
    });
  } catch (error: any) {
    // L'envoi a echoue : le jeton ne sert a rien, autant le retirer.
    revokeTokensFor(email);

    const status = error instanceof SheetError ? error.status : 500;
    return res.status(status).json({
      error:
        `L'envoi de l'email a échoué (${error.message}). ` +
        'Demandez à un organisateur de réinitialiser votre mot de passe.',
      reason: error instanceof SheetError ? error.reason : 'mailer_error',
    });
  }

  res.json(neutral);
});

/** Verifie un lien avant d'afficher le formulaire, sans le consommer. */
authRouter.get('/reset', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const entry = peekToken(token);

  if (!entry) {
    return res.status(410).json({
      error: 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.',
      reason: 'invalid_token',
    });
  }

  res.json({ valid: true, email: entry.email });
});

authRouter.post('/reset', async (req: AuthedRequest, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const invalid = validatePassword(password);
  if (invalid) {
    return res.status(400).json({ error: invalid, reason: 'weak_password' });
  }

  const entry = consumeToken(token);
  if (!entry) {
    return res.status(410).json({
      error: 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.',
      reason: 'invalid_token',
    });
  }

  const hash = await hashPassword(password);

  if (!setPasswordHash(entry.email, hash)) {
    // Le compte vient du classeur sans avoir encore ete enregistre localement.
    try {
      const { account, source } = await resolveAccount(entry.email);
      upsertAccount({
        email: entry.email,
        name: account.name,
        role: account.role,
        status: account.status,
        passwordHash: hash,
        institution: account.institution,
        position: account.position,
        assignedBy: source === 'sheet' ? 'Synchronisation classeur' : account.assignedBy,
      });
    } catch {
      return res.status(404).json({ error: 'Compte introuvable.', reason: 'not_found' });
    }
  }

  // Un mot de passe change ferme les sessions ouvertes : si quelqu'un d'autre
  // etait connecte sur ce compte, il perd l'acces.
  revokeSessionsForEmail(entry.email);

  const { warning } = await rememberHashInSheet(entry.email, hash);

  res.json({
    ok: true,
    email: entry.email,
    message: 'Mot de passe enregistré. Vous pouvez maintenant vous connecter.',
    warning,
  });
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

  const changedHash = await hashPassword(next);
  setPasswordHash(session.email, changedHash);
  const { warning: changeWarning } = await rememberHashInSheet(session.email, changedHash);

  res.json({
    ok: true,
    message:
      'Mot de passe modifié. Il servira à vos prochaines connexions.' +
      (changeWarning ? ` ${changeWarning}` : ''),
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

  // L'administrateur n'attribue plus de mot de passe : il désigne un email et
  // un rôle, et la personne choisit elle-même son mot de passe en s'inscrivant.
  // Personne d'autre qu'elle ne le connaît donc jamais.
  const account = upsertAccount({
    email,
    role,
    status,
    name: typeof req.body?.name === 'string' ? req.body.name : undefined,
    institution: typeof req.body?.institution === 'string' ? req.body.institution : undefined,
    position: typeof req.body?.position === 'string' ? req.body.position : undefined,
    assignedBy: req.session!.name,
  });

  // Les sessions ouvertes de cet email suivent immediatement le nouveau role.
  const touched = updateSessionsForEmail(email, { role: account.role, status: account.status });

  res.json({
    account: toPublicAccount(account),
    sessionsUpdated: touched,
    needsRegistration: !account.passwordHash,
  });
});

/**
 * Réinitialisation par l'organisateur : le mot de passe est effacé, pas
 * remplacé. Le compte redevient « à activer », et la personne en choisit un
 * nouveau en s'inscrivant — l'organisateur n'a donc jamais à en connaître un.
 */
authRouter.post(
  '/accounts/:email/reset-password',
  requireCapability('canManageRoles'),
  async (req: AuthedRequest, res) => {
    const email = normalizeEmail(req.params.email);

    if (!clearPassword(email)) {
      return res.status(404).json({ error: 'Compte introuvable.', reason: 'not_found' });
    }

    // Le compte ne doit plus pouvoir servir avec l'ancien mot de passe.
    revokeSessionsForEmail(email);
    revokeTokensFor(email);

    // La colonne du classeur doit suivre : une empreinte qui y resterait
    // ressusciterait l'ancien mot de passe au prochain redemarrage.
    const { warning } = await forgetHashInSheet(email);

    res.json({
      ok: true,
      message:
        `Mot de passe de ${email} effacé. La personne doit maintenant s'inscrire pour en choisir un nouveau.` +
        (warning ? ` ${warning}` : ''),
    });
  },
);

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
    const table = await readTab(config.profilesTab, config, expectedHeadersFor('profiles'));
    const accounts = mapUserAccounts(table);

    if (accounts.length === 0) {
      return res.status(422).json({
        error:
          `Aucune colonne « Email » exploitable dans l'onglet « ${config.profilesTab} ». ` +
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

/* ------------------------------------------------------------------ *
 * Informations de profil
 * ------------------------------------------------------------------ */

/**
 * Chacun renseigne son propre profil, et seulement le sien.
 *
 * L'email vient de la session, jamais du corps de la requête. Le rôle, le
 * statut et l'empreinte du mot de passe ne figurent pas dans les champs
 * acceptés : sans cela, n'importe qui pourrait se nommer administrateur.
 */
authRouter.post('/profile', requireAuth, async (req: AuthedRequest, res) => {
  const email = req.session!.email;
  const checked = checkProfile(req.body);

  if (checked.error || !checked.patch) {
    return res.status(400).json({ error: checked.error, reason: checked.reason });
  }

  const patch = checked.patch;

  // Un compte lu du classeur n'est pas encore dans la table du serveur : il y
  // est placé d'abord, sinon les informations n'auraient nulle part où tenir.
  if (!findAccount(email)) {
    try {
      const { account, source } = await resolveAccount(email);
      upsertAccount({
        email,
        name: account.name,
        role: account.role,
        status: account.status,
        institution: account.institution,
        position: account.position,
        ticketNumber: account.ticketNumber,
        avatarUrl: account.avatarUrl,
        assignedBy: source === 'sheet' ? 'Synchronisation classeur' : account.assignedBy,
      });
    } catch {
      return res.status(404).json({ error: 'Compte introuvable.', reason: 'not_found' });
    }
  }

  const compte = updateProfileFields(email, existant => appliquerPatch(existant, patch));

  if (!compte) {
    return res.status(404).json({ error: 'Compte introuvable.', reason: 'not_found' });
  }

  // Le nom s'affiche dans les sessions ouvertes : il doit y suivre.
  if (patch.name) updateSessionsForEmail(email, { name: compte.name });

  const { warning } = await saveProfileInSheet(email, patch);

  res.json({
    ok: true,
    profile: toPublicAccount(compte),
    message: 'Profil mis à jour.',
    warning,
  });
});

/* ------------------------------------------------------------------ *
 * Photo de profil
 * ------------------------------------------------------------------ */

/**
 * Chacun change sa propre photo, et seulement la sienne.
 *
 * L'email vient de la session, jamais du corps de la requête : sans cela,
 * n'importe qui pourrait remplacer la photo d'un organisateur, ce qui est
 * précisément l'image dont on se méfie le moins.
 */
authRouter.post('/photo', requireAuth, async (req: AuthedRequest, res) => {
  const email = req.session!.email;
  const checked = checkPhoto(req.body?.photo);

  if (checked.error) {
    return res.status(400).json({ error: checked.error, reason: checked.reason });
  }

  // Un compte lu du classeur n'est pas encore dans la table du serveur : il y
  // est placé avant, sinon la photo n'aurait nulle part où tenir.
  if (!setAvatar(email, checked.value)) {
    try {
      const { account, source } = await resolveAccount(email);
      upsertAccount({
        email,
        name: account.name,
        role: account.role,
        status: account.status,
        institution: account.institution,
        position: account.position,
        ticketNumber: account.ticketNumber,
        avatarUrl: checked.value,
        assignedBy: source === 'sheet' ? 'Synchronisation classeur' : account.assignedBy,
      });
    } catch {
      return res.status(404).json({ error: 'Compte introuvable.', reason: 'not_found' });
    }
  }

  const { warning } = await savePhotoInSheet(email, checked.value);
  const account = findAccount(email);

  res.json({
    ok: true,
    profile: account ? toPublicAccount(account) : null,
    message: checked.value ? 'Photo mise à jour.' : 'Photo retirée.',
    warning,
  });
});
