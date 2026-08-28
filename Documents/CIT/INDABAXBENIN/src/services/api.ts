import {
  AuthSession,
  CheckInRecord,
  ParticipantRole,
  PublicSheetsConfig,
  SessionFeedback,
  UserAccount,
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
  profile: (Omit<UserAccount, 'accessCode'> & { hasAccessCode: boolean }) | null;
  warning?: string;
}

export function login(email: string, code?: string): Promise<AuthPayload> {
  return request<AuthPayload>('/api/auth/login', { method: 'POST', body: { email, code } });
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

type PublicAccount = Omit<UserAccount, 'accessCode'> & { hasAccessCode: boolean };

export async function listAccounts(): Promise<PublicAccount[]> {
  const data = await request<{ accounts: PublicAccount[] }>('/api/auth/accounts');
  return data.accounts;
}

export function assignRole(input: {
  email: string;
  role: ParticipantRole;
  name?: string;
  status?: UserAccount['status'];
  accessCode?: string;
  institution?: string;
  position?: string;
}): Promise<{ account: PublicAccount; sessionsUpdated: number }> {
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
  usersTab?: string;
  participantsTab?: string;
  sessionsTab?: string;
  checkInsTab?: string;
  feedbacksTab?: string;
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
  usersTab?: string,
): Promise<{ config: PublicSheetsConfig; accounts: number; sessionsUpdated: number; message: string }> {
  return request('/api/sheets/link', { method: 'POST', body: { masterSheetUrl, usersTab } });
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
