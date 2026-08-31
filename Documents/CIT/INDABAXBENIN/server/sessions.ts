import crypto from 'crypto';
import type { Request, Response } from 'express';
import { AccountStatus, ParticipantRole } from '../src/types';
import { capabilitiesFor, RoleCapabilities } from '../src/permissions';

/**
 * Sessions serveur.
 *
 * Le navigateur ne recoit qu'un identifiant opaque dans un cookie HttpOnly :
 * il ne porte ni le role ni aucune donnee exploitable. Le role est relu dans
 * le magasin serveur a chaque requete, ce qui rend les verifications
 * d'autorisation reellement contraignantes.
 */

export const SESSION_COOKIE = 'indabax_session';

/**
 * Le drapeau `Secure` empeche le navigateur d'envoyer le cookie hors HTTPS.
 *
 * Il est actif par defaut en production, ce qui est le bon reglage. Mais un
 * deploiement derriere un reverse proxy qui termine TLS, ou une mise en service
 * provisoire en HTTP, rendrait la connexion silencieusement impossible : le
 * cookie serait pose puis jamais renvoye. `COOKIE_SECURE=false` permet alors
 * de lever le drapeau en connaissance de cause.
 */
function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === 'false') return false;
  if (process.env.COOKIE_SECURE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

/** Duree de vie d'une session : une journee d'evenement. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Au-dela, une session inactive est purgee meme si elle n'a pas expire. */
const IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;

export interface ServerSession {
  id: string;
  email: string;
  name: string;
  role: ParticipantRole;
  status: AccountStatus;
  /** Origine du role : classeur, table locale du serveur, ou email admin d'amorcage. */
  source: 'sheet' | 'local' | 'bootstrap';
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

const sessions = new Map<string, ServerSession>();

function newSessionId(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function createSession(input: {
  email: string;
  name: string;
  role: ParticipantRole;
  status: AccountStatus;
  source: ServerSession['source'];
}): ServerSession {
  const now = Date.now();

  const session: ServerSession = {
    id: newSessionId(),
    email: input.email,
    name: input.name,
    role: input.role,
    status: input.status,
    source: input.source,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessions.set(session.id, session);
  return session;
}

/** Analyse minimale de l'en-tete Cookie : evite une dependance supplementaire. */
function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;

    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

export function getSession(req: Request): ServerSession | null {
  const id = readCookie(req, SESSION_COOKIE);
  if (!id) return null;

  const session = sessions.get(id);
  if (!session) return null;

  const now = Date.now();
  if (now > session.expiresAt || now - session.lastSeenAt > IDLE_TIMEOUT_MS) {
    sessions.delete(id);
    return null;
  }

  session.lastSeenAt = now;
  return session;
}

export function destroySession(req: Request): void {
  const id = readCookie(req, SESSION_COOKIE);
  if (id) sessions.delete(id);
}

/** Met a jour le role d'une session ouverte (l'admin vient de le changer). */
export function updateSessionRole(
  sessionId: string,
  patch: { role?: ParticipantRole; status?: AccountStatus; name?: string; source?: ServerSession['source'] },
): ServerSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  Object.assign(session, patch);
  return session;
}

/** Applique un changement de role a toutes les sessions ouvertes d'un email. */
export function updateSessionsForEmail(
  email: string,
  patch: { role?: ParticipantRole; status?: AccountStatus },
): number {
  let touched = 0;

  for (const session of sessions.values()) {
    if (session.email !== email) continue;

    Object.assign(session, patch);
    touched += 1;

    // Un compte suspendu perd immediatement sa session.
    if (patch.status === 'suspended') {
      sessions.delete(session.id);
    }
  }

  return touched;
}

export function revokeSessionsForEmail(email: string): number {
  let removed = 0;

  for (const [id, session] of sessions.entries()) {
    if (session.email === email) {
      sessions.delete(id);
      removed += 1;
    }
  }

  return removed;
}

export function setSessionCookie(res: Response, session: ServerSession): void {
  res.cookie(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
  });
}

/** Vue de la session transmise au client : pas d'identifiant, pas de secret. */
export function toClientSession(session: ServerSession) {
  return {
    email: session.email,
    name: session.name,
    role: session.role,
    status: session.status,
    source: session.source,
    signedInAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Garde-fous d'autorisation
 * ------------------------------------------------------------------ */

export interface AuthedRequest extends Request {
  session?: ServerSession;
  capabilities?: RoleCapabilities;
}

/** Exige une session valide. */
export function requireAuth(req: AuthedRequest, res: Response, next: () => void) {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({ error: 'Session expirée ou absente. Reconnectez-vous.', reason: 'unauthenticated' });
  }

  if (session.status === 'suspended') {
    destroySession(req);
    clearSessionCookie(res);
    return res.status(403).json({ error: 'Ce compte a été suspendu.', reason: 'suspended' });
  }

  req.session = session;
  req.capabilities = capabilitiesFor(session.role);
  next();
}

/** Exige une capacite precise du role, par exemple `canManageRoles`. */
export function requireCapability(capability: keyof RoleCapabilities) {
  return (req: AuthedRequest, res: Response, next: () => void) => {
    requireAuth(req, res, () => {
      if (req.capabilities && req.capabilities[capability] === true) return next();

      res.status(403).json({
        error: "Votre rôle ne permet pas cette action.",
        reason: 'forbidden',
        required: capability,
      });
    });
  };
}

/** Purge periodique des sessions expirees. */
export function startSessionSweeper(intervalMs = 15 * 60 * 1000) {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (now > session.expiresAt || now - session.lastSeenAt > IDLE_TIMEOUT_MS) {
        sessions.delete(id);
      }
    }
  }, intervalMs);

  timer.unref?.();
  return timer;
}

export function sessionCount(): number {
  return sessions.size;
}

/** Etat du drapeau Secure, pour l'afficher au demarrage. */
export function isCookieSecure(): boolean {
  return cookieSecure();
}
