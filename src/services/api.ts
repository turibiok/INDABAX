import {
  AuthSession,
  CheckInRecord,
  ParticipantRole,
  PublicSheetsConfig,
  PublicUserAccount,
  SessionFeedback,
} from '../types';
import { RoleCapabilities } from '../permissions';

/**
 * Client HTTP de l'API de l'application.
 *
 * Toutes les décisions d'autorisation sont prises par le serveur : ce module
 * ne fait que transporter les requêtes. Le cookie de session est HttpOnly,
 * donc invisible et non modifiable depuis le JavaScript de la page.
 */

export class ApiError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.reason = reason;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method: options.method || 'GET',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // Le cookie de session doit accompagner chaque appel.
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError("Le serveur de l'application est injoignable.", 0, 'network');
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => ({}) as any);

  if (!response.ok) {
    throw new ApiError(
      data?.error || `La requête a échoué (HTTP ${response.status}).`,
      response.status,
      data?.reason,
    );
  }

  return data as T;
}

/* ------------------------------------------------------------------ *
 * Authentification
 * ------------------------------------------------------------------ */

export interface AuthPayload {
  session: AuthSession;
  capabilities: RoleCapabilities;
  profile: PublicUserAccount | null;
  warning?: string;
}

export function login(email: string, password: string): Promise<AuthPayload> {
  return request<AuthPayload>('/api/auth/login', { method: 'POST', body: { email, password } });
}

/** Changement de son propre mot de passe. L'actuel est exigé. */
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  return request('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
}

/**
 * Inscription : la personne choisit elle-même son mot de passe.
 *
 * C'est une activation, pas une création libre — l'email doit déjà figurer
 * dans la base des comptes, où l'administrateur a fixé le rôle.
 */
export function register(email: string, password: string): Promise<AuthPayload> {
  return request<AuthPayload>('/api/auth/register', { method: 'POST', body: { email, password } });
}

/** Dit si un email doit s'inscrire ou se connecter, pour orienter la saisie. */
export function accountStatus(email: string): Promise<{ known: boolean; needsRegistration: boolean }> {
  return request('/api/auth/status', { method: 'POST', body: { email } });
}

/** Demande un lien de réinitialisation par email. */
export function forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
  return request('/api/auth/forgot', { method: 'POST', body: { email } });
}

/** Vérifie un lien de réinitialisation sans le consommer. */
export function checkResetToken(token: string): Promise<{ valid: boolean; email: string }> {
  return request(`/api/auth/reset?token=${encodeURIComponent(token)}`);
}

/** Choisit un nouveau mot de passe à partir d'un lien reçu par email. */
export function resetPassword(
  token: string,
  password: string,
): Promise<{ ok: boolean; email: string; message: string }> {
  return request('/api/auth/reset', { method: 'POST', body: { token, password } });
}

/** Réinitialisation par l'organisateur : le mot de passe est effacé. */
export function clearAccountPassword(email: string): Promise<{ ok: boolean; message: string }> {
  return request(`/api/auth/accounts/${encodeURIComponent(email)}/reset-password`, { method: 'POST' });
}

/**
 * État de la session au démarrage. `null` si personne n'est connecté.
 * La sonde répond 200 dans les deux cas : pas d'erreur en console.
 */
export async function currentSession(): Promise<AuthPayload | null> {
  try {
    const payload = await request<AuthPayload | { session: null }>('/api/auth/session');
    return payload.session ? (payload as AuthPayload) : null;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

export function logout(): Promise<{ ok: boolean }> {
  return request('/api/auth/logout', { method: 'POST' });
}

export function refreshSession(): Promise<AuthPayload & { changed: boolean }> {
  return request('/api/auth/refresh', { method: 'POST' });
}

/* ------------------------------------------------------------------ *
 * Comptes et rôles (réservé à canManageRoles côté serveur)
 * ------------------------------------------------------------------ */

export async function listAccounts(): Promise<PublicUserAccount[]> {
  const data = await request<{ accounts: PublicUserAccount[] }>('/api/auth/accounts');
  return data.accounts;
}

export interface AssignRoleResult {
  account: PublicUserAccount;
  sessionsUpdated: number;
  /** Le compte n'a pas encore de mot de passe : la personne doit s'inscrire. */
  needsRegistration: boolean;
}

/**
 * Attribution d'un rôle à un email.
 *
 * Aucun mot de passe n'est transmis : c'est la personne qui choisit le sien en
 * s'inscrivant, et personne d'autre ne le connaît jamais.
 */
export function assignRole(input: {
  email: string;
  role: ParticipantRole;
  name?: string;
  status?: PublicUserAccount['status'];
  institution?: string;
  position?: string;
}): Promise<AssignRoleResult> {
  return request('/api/auth/accounts', { method: 'POST', body: input });
}

export function deleteAccount(email: string): Promise<{ removed: boolean }> {
  return request(`/api/auth/accounts/${encodeURIComponent(email)}`, { method: 'DELETE' });
}

export function reloadAccounts(): Promise<{ count: number; sessionsUpdated: number }> {
  return request('/api/auth/accounts/reload', { method: 'POST' });
}

/* ------------------------------------------------------------------ *
 * Configuration du classeur
 * ------------------------------------------------------------------ */

export async function fetchSheetsConfig(): Promise<PublicSheetsConfig> {
  const data = await request<{ config: PublicSheetsConfig }>('/api/sheets/config');
  return data.config;
}

export async function saveSheetsConfig(patch: {
  profilesTab?: string;
  sessionsTab?: string;
  checkInsTab?: string;
  feedbacksTab?: string;
  announcementsTab?: string;
  messagesTab?: string;
  autoSync?: boolean;
  writeWebhookUrl?: string;
  appSheetAppId?: string;
  appSheetAccessKey?: string;
}): Promise<PublicSheetsConfig> {
  const data = await request<{ config: PublicSheetsConfig }>('/api/sheets/config', {
    method: 'PUT',
    body: patch,
  });
  return data.config;
}

export function linkSheet(
  masterSheetUrl: string,
  profilesTab?: string,
): Promise<{ config: PublicSheetsConfig; accounts: number; sessionsUpdated: number; message: string }> {
  return request('/api/sheets/link', { method: 'POST', body: { masterSheetUrl, profilesTab } });
}

export async function unlinkSheet(): Promise<PublicSheetsConfig> {
  const data = await request<{ config: PublicSheetsConfig }>('/api/sheets/unlink', { method: 'POST' });
  return data.config;
}

/* ------------------------------------------------------------------ *
 * Données du classeur
 * ------------------------------------------------------------------ */

export function fetchSheetData(
  kind: 'participants' | 'sessions' | 'announcements',
): Promise<{ headers: string[]; rows: Record<string, string>[]; count: number }> {
  return request(`/api/sheets/data/${kind}`);
}

/** Le serveur reconstruit les lignes : il n'écrit jamais des colonnes libres. */
export function appendCheckIns(records: CheckInRecord[]): Promise<{ ok: boolean; written: number }> {
  return request('/api/sheets/append/checkins', {
    method: 'POST',
    body: {
      rows: records.map(record => ({
        participantName: record.participantName,
        participantEmail: record.participantEmail,
        ticketNumber: record.ticketNumber,
        sessionId: record.sessionId,
        sessionTitle: record.sessionTitle,
        room: record.room,
      })),
    },
  });
}

export function appendFeedbacks(items: SessionFeedback[]): Promise<{ ok: boolean; written: number }> {
  return request('/api/sheets/append/feedbacks', {
    method: 'POST',
    body: {
      rows: items.map(feedback => ({
        sessionTitle: feedback.sessionTitle,
        overallRating: feedback.overallRating,
        contentQuality: feedback.contentQuality,
        speakerClarity: feedback.speakerClarity,
        practicalRelevance: feedback.practicalRelevance,
        comments: feedback.comments,
        questionForSpeaker: feedback.questionForSpeaker,
      })),
    },
  });
}

/* ------------------------------------------------------------------ *
 * Annonces, discussions et commentaires
 * ------------------------------------------------------------------ */

export interface ServerComment {
  id: string;
  authorName: string;
  authorEmail: string;
  authorRole: ParticipantRole;
  content: string;
  timestamp: string;
}

export interface ServerAnnouncement {
  id: string;
  timestamp: string;
  category: string;
  title: string;
  content: string;
  authorName: string;
  authorEmail: string;
  authorRole: ParticipantRole;
  pinned: boolean;
  retired: boolean;
  likes: number;
  likedByMe: boolean;
  comments: ServerComment[];
}

export interface ServerMessage {
  id: string;
  timestamp: string;
  thread: string;
  authorName: string;
  authorEmail: string;
  authorRole: ParticipantRole;
  content: string;
}

export async function fetchAnnouncements(): Promise<ServerAnnouncement[]> {
  const data = await request<{ announcements: ServerAnnouncement[] }>('/api/social/announcements');
  return data.announcements;
}

export function publishAnnouncement(input: {
  title: string;
  content: string;
  category: string;
  pinned?: boolean;
}): Promise<{ announcement: ServerAnnouncement; warning?: string }> {
  return request('/api/social/announcements', { method: 'POST', body: input });
}

export function pinAnnouncement(id: string, pinned: boolean): Promise<{ ok: boolean; warning?: string }> {
  return request(`/api/social/announcements/${encodeURIComponent(id)}/pin`, {
    method: 'POST',
    body: { pinned },
  });
}

export function retireAnnouncement(id: string): Promise<{ ok: boolean; warning?: string }> {
  return request(`/api/social/announcements/${encodeURIComponent(id)}/retire`, { method: 'POST' });
}

export function likeAnnouncement(
  id: string,
): Promise<{ liked: boolean; likes: number; warning?: string }> {
  return request(`/api/social/announcements/${encodeURIComponent(id)}/like`, { method: 'POST' });
}

/** Messages d'un fil, ou de tous les fils quand `thread` est absent. */
export async function fetchMessages(
  thread?: string,
): Promise<{ messages: ServerMessage[]; counts: Record<string, number> }> {
  const query = thread ? `?thread=${encodeURIComponent(thread)}` : '';
  return request(`/api/social/messages${query}`);
}

export function sendMessage(
  thread: string,
  content: string,
): Promise<{ message: ServerMessage; warning?: string }> {
  return request('/api/social/messages', { method: 'POST', body: { thread, content } });
}

export function retireMessage(id: string): Promise<{ ok: boolean; warning?: string }> {
  return request(`/api/social/messages/${encodeURIComponent(id)}/retire`, { method: 'POST' });
}
