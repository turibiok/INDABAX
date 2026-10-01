import crypto from 'crypto';
import type { Request, Response } from 'express';
import { AccountStatus, ParticipantRole } from '../src/types';
import { capabilitiesFor, RoleCapabilities } from '../src/permissions';
import {
  compter as compterSessions,
  enregistrer as enregistrerSession,
  lire as lireSession,
  lireBrute as lireSessionBrute,
  modifierPourEmail as modifierSessionsPourEmail,
  purger as purgerSessions,
  revoquerPourEmail as revoquerSessionsPourEmail,
  supprimer as supprimerSession,
} from './sessionStore';

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
  /**
   * D'ou vient le compte qui a ouvert cette session.
   *
   * « platform » designe un compte de la plateforme, qui n'existe pas dans le
   * classeur d'un evenement : le distinguer evite qu'une synchronisation du
   * classeur le croie disparu et le revoque.
   */
  source: 'sheet' | 'local' | 'bootstrap' | 'platform';
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}


function newSessionId(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function createSession(input: {
  email: string;
  name: string;
  role: ParticipantRole;
  status: AccountStatus;
  source: ServerSession['source'];
}): Promise<ServerSession> {
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

  /*
   * L'ecriture est attendue, et c'est indispensable.
   *
   * Elle ne l'etait pas : la session etait rendue avant d'etre enregistree, au
   * motif qu'elle etait deja utilisable. Elle ne l'etait pas — la requete
   * suivante part aussitot, et la lecture en base arrivait avant l'ecriture.
   * On se connectait donc avec succes pour etre refuse dans la foulee, d'autant
   * plus surement que la base est lointaine.
   *
   * Le cout est un aller-retour sur la seule connexion. Il est du.
   */
  await enregistrerSession(session);
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

export async function getSession(req: Request): Promise<ServerSession | null> {
  const id = readCookie(req, SESSION_COOKIE);
  if (!id) return null;

  const lue = await lireSession(id, IDLE_TIMEOUT_MS);
  return lue ? (lue as ServerSession) : null;
}

export async function destroySession(req: Request): Promise<void> {
  const id = readCookie(req, SESSION_COOKIE);
  if (id) await supprimerSession(id);
}

/** Met a jour le role d'une session ouverte (l'admin vient de le changer). */
export async function updateSessionRole(
  sessionId: string,
  patch: { role?: ParticipantRole; status?: AccountStatus; name?: string; source?: ServerSession['source'] },
): Promise<ServerSession | null> {
  const brute = await lireSessionBrute(sessionId);
  if (!brute) return null;

  const session = { ...brute, ...patch } as unknown as ServerSession;
  await enregistrerSession(session as never);
  return session;
}

/** Applique un changement de role a toutes les sessions ouvertes d'un email. */
/**
 * Repercute un changement de compte sur les sessions deja ouvertes.
 *
 * Sans cela, quelqu'un dont on vient de retirer les droits les garderait
 * jusqu'a sa prochaine connexion — c'est-a-dire potentiellement des jours.
 */
export async function updateSessionsForEmail(
  email: string,
  patch: { role?: ParticipantRole; status?: AccountStatus; name?: string; source?: ServerSession['source'] },
): Promise<number> {
  return modifierSessionsPourEmail(email, patch as never);
}

/** Revoque toutes les sessions d'une personne. */
export async function revokeSessionsForEmail(email: string): Promise<number> {
  return revoquerSessionsPourEmail(email);
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
export async function requireAuth(req: AuthedRequest, res: Response, next: () => void) {
  let session: ServerSession | null = null;

  try {
    session = await getSession(req);
  } catch (erreur) {
    // Une base injoignable ne doit pas passer pour une session valide : on
    // refuse, en disant que c'est le service et non le compte.
    console.warn(`Lecture de session impossible : ${(erreur as Error)?.message || erreur}`);
    return res.status(503).json({
      error: 'Service momentanément indisponible. Réessayez dans un instant.',
      reason: 'session_unavailable',
    });
  }

  if (!session) {
    return res.status(401).json({ error: 'Session expirée ou absente. Reconnectez-vous.', reason: 'unauthenticated' });
  }

  if (session.status === 'suspended') {
    await destroySession(req);
    clearSessionCookie(res);
    return res.status(403).json({ error: 'Ce compte a été suspendu.', reason: 'suspended' });
  }

  req.session = session;
  req.capabilities = capabilitiesFor(session.role);
  next();
}

/** Exige une capacite precise du role, par exemple `canManageRoles`. */
export function requireCapability(capability: keyof RoleCapabilities) {
  return async (req: AuthedRequest, res: Response, next: () => void) => {
    await requireAuth(req, res, () => {
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
/**
 * Purge periodique des sessions perimees.
 *
 * Sans effet chez un hebergeur sans etat, ou le processus ne vit pas assez
 * longtemps pour qu'un intervalle se declenche : la lecture d'une session
 * efface de toute facon celles qu'elle trouve perimees.
 */
export function startSessionSweeper(intervalMs = 15 * 60 * 1000) {
  const timer = setInterval(() => {
    void purgerSessions(IDLE_TIMEOUT_MS).catch(erreur =>
      console.warn(`Purge des sessions impossible : ${(erreur as Error)?.message || erreur}`),
    );
  }, intervalMs);

  timer.unref?.();
  return timer;
}

export function sessionCount(): Promise<number> {
  return compterSessions();
}

/** Etat du drapeau Secure, pour l'afficher au demarrage. */
export function isCookieSecure(): boolean {
  return cookieSecure();
}
