import { AuthSession, SheetsLinkConfig, UserAccount } from '../types';
import { normalizeEmail } from '../lib/sheets';
import { SheetsDbError } from './sheetsDb';

/**
 * Authentification par email, avec rôle attribué par l'administrateur.
 *
 * L'ordre de résolution du rôle est le suivant :
 *  1. la table `Utilisateurs` du classeur Google Sheet lié (source de vérité) ;
 *  2. la table locale gérée par le Super-Admin dans l'application ;
 *  3. la liste de secours des emails administrateurs (permet le tout premier accès) ;
 *  4. un compte « participant en attente », si l'auto-inscription est activée.
 */

const SESSION_STORAGE_KEY = 'indabax_auth_session';

export class AuthError extends Error {
  reason: AuthErrorReason;

  constructor(message: string, reason: AuthErrorReason) {
    super(message);
    this.name = 'AuthError';
    this.reason = reason;
  }
}

export type AuthErrorReason =
  | 'invalid_email'
  | 'not_found'
  | 'suspended'
  | 'code_required'
  | 'bad_code'
  | 'no_database'
  | 'unknown';

export interface SignInParams {
  email: string;
  code?: string;
  config: SheetsLinkConfig;
  /** Emails autorisés à devenir Super-Admin sans passer par le classeur. */
  adminEmails: string[];
  /** Comptes gérés localement par le Super-Admin (miroir hors ligne du classeur). */
  localAccounts: UserAccount[];
  allowSelfSignup: boolean;
}

export interface SignInResult {
  session: AuthSession;
  account: UserAccount;
  /** Message non bloquant : par exemple, classeur injoignable, repli local utilisé. */
  warning?: string;
}

function buildSession(account: UserAccount, source: AuthSession['source']): AuthSession {
  return {
    email: account.email,
    role: account.role,
    name: account.name,
    status: account.status,
    source,
    signedInAt: new Date().toISOString(),
  };
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return local
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Vérifie le code d'accès d'un compte connu localement. */
function checkLocalCode(account: UserAccount, code?: string) {
  if (!account.accessCode) return;

  const provided = (code || '').trim();
  if (!provided) {
    throw new AuthError("Un code d'accès est requis pour ce compte.", 'code_required');
  }
  if (provided.toLowerCase() !== account.accessCode.trim().toLowerCase()) {
    throw new AuthError("Code d'accès incorrect.", 'bad_code');
  }
}

/** Cherche l'email dans la table locale, puis dans la liste des admins de secours. */
function resolveOffline(
  email: string,
  code: string | undefined,
  localAccounts: UserAccount[],
  adminEmails: string[],
  allowSelfSignup: boolean,
): { account: UserAccount; source: AuthSession['source'] } {
  const local = localAccounts.find(candidate => normalizeEmail(candidate.email) === email);

  if (local) {
    if (local.status === 'suspended') {
      throw new AuthError("Ce compte a été suspendu par l'administrateur.", 'suspended');
    }
    checkLocalCode(local, code);
    return { account: local, source: 'local' };
  }

  const isBootstrapAdmin = adminEmails.some(admin => normalizeEmail(admin) === email);
  if (isBootstrapAdmin) {
    return {
      account: {
        email,
        name: nameFromEmail(email),
        role: 'super-admin',
        status: 'active',
      },
      source: 'bootstrap',
    };
  }

  if (allowSelfSignup) {
    return {
      account: {
        email,
        name: nameFromEmail(email),
        role: 'attendee',
        status: 'pending',
      },
      source: 'local',
    };
  }

  throw new AuthError(
    "Cet email n'est pas enregistré. Demandez à un organisateur de vous ajouter dans la base des comptes.",
    'not_found',
  );
}

/** Connexion : renvoie la session et le compte résolu. */
export async function signIn(params: SignInParams): Promise<SignInResult> {
  const { code, config, adminEmails, localAccounts, allowSelfSignup } = params;
  const email = normalizeEmail(params.email);

  if (!email || !email.includes('@') || !email.includes('.')) {
    throw new AuthError('Veuillez saisir une adresse email valide.', 'invalid_email');
  }

  // Un email administrateur de secours passe toujours, même si le classeur
  // est mal configuré : sans cela, personne ne pourrait lier le classeur.
  const isBootstrapAdmin = adminEmails.some(admin => normalizeEmail(admin) === email);

  if (!config.masterSheetUrl.trim()) {
    const offline = resolveOffline(email, code, localAccounts, adminEmails, allowSelfSignup);
    return {
      session: buildSession(offline.account, offline.source),
      account: offline.account,
      warning:
        offline.source === 'bootstrap'
          ? 'Aucun classeur Google Sheet lié : connexion via la liste des emails administrateurs.'
          : "Aucun classeur Google Sheet lié : les rôles proviennent de la table locale de l'application.",
    };
  }

  let response: Response;
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheetUrl: config.masterSheetUrl,
        usersTab: config.usersTab,
        email,
        code,
      }),
    });
  } catch {
    const offline = resolveOffline(email, code, localAccounts, adminEmails, allowSelfSignup);
    return {
      session: buildSession(offline.account, offline.source),
      account: offline.account,
      warning: 'Serveur injoignable : connexion en mode hors ligne avec les rôles enregistrés localement.',
    };
  }

  const data = await response.json().catch(() => ({} as any));

  if (response.ok && data?.user) {
    const account = data.user as UserAccount;
    return { session: buildSession(account, 'sheet'), account };
  }

  const reason: AuthErrorReason = data?.reason || 'unknown';

  // Un mauvais code reste un mauvais code : pas de repli hors ligne.
  if (reason === 'code_required' || reason === 'bad_code' || reason === 'suspended') {
    throw new AuthError(data?.error || 'Connexion refusée.', reason);
  }

  // Email absent du classeur, ou classeur illisible : on tente le repli.
  try {
    const offline = resolveOffline(email, code, localAccounts, adminEmails, allowSelfSignup);
    return {
      session: buildSession(offline.account, offline.source),
      account: offline.account,
      warning:
        reason === 'not_found'
          ? "Email absent du classeur : rôle appliqué depuis la configuration locale."
          : `Classeur illisible (${data?.error || 'erreur inconnue'}) : rôle appliqué depuis la configuration locale.`,
    };
  } catch (offlineError) {
    if (isBootstrapAdmin) throw offlineError;
    throw new AuthError(
      data?.error || (offlineError as Error).message,
      reason === 'unknown' ? 'not_found' : reason,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Persistance de la session
 * ------------------------------------------------------------------ */

export function loadStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.email || !parsed?.role) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('Session non persistée :', error);
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* stockage indisponible : rien à faire */
  }
}

/** Rejoue la résolution du rôle depuis le classeur, pour une session déjà ouverte. */
export async function refreshRole(
  session: AuthSession,
  config: SheetsLinkConfig,
): Promise<{ session: AuthSession; changed: boolean } | null> {
  if (!config.masterSheetUrl.trim()) return null;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetUrl: config.masterSheetUrl, usersTab: config.usersTab, email: session.email }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const account = data?.user as UserAccount | undefined;
    if (!account) return null;

    const updated = buildSession(account, 'sheet');
    return { session: updated, changed: updated.role !== session.role || updated.status !== session.status };
  } catch {
    return null;
  }
}

export { SheetsDbError };
