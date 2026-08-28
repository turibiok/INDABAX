import fs from 'fs';
import path from 'path';
import { AccountStatus, ParticipantRole, UserAccount } from '../src/types';
import { normalizeEmail, parseRole, parseStatus } from '../src/lib/sheets';
import { INITIAL_USER_ACCOUNTS } from '../src/data/mockData';

/**
 * Etat persistant du serveur : configuration de la base Google Sheet et
 * table locale des comptes.
 *
 * Ces donnees vivent COTE SERVEUR et non plus dans le navigateur : c'est ce
 * qui permet aux roles d'etre une vraie frontiere. Le client ne peut plus
 * rediriger l'application vers son propre classeur pour s'attribuer un role.
 */

const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'server-state.json');

/** Configuration du classeur, secrets d'ecriture inclus. */
export interface ServerSheetsConfig {
  masterSheetUrl: string;
  usersTab: string;
  participantsTab: string;
  sessionsTab: string;
  checkInsTab: string;
  feedbacksTab: string;
  /** Secret : ne quitte jamais le serveur. */
  writeWebhookUrl: string;
  /** Secret : ne quitte jamais le serveur. */
  appSheetAppId: string;
  /** Secret : ne quitte jamais le serveur. */
  appSheetAccessKey: string;
  isLinked: boolean;
  lastSyncTimestamp?: string;
  lastError?: string;
  autoSync: boolean;
}

interface ServerState {
  version: 1;
  sheets: ServerSheetsConfig;
  /** Table locale des comptes, utilisee quand aucun classeur n'est lie. */
  accounts: UserAccount[];
}

export const DEFAULT_SERVER_SHEETS_CONFIG: ServerSheetsConfig = {
  masterSheetUrl: '',
  usersTab: 'Utilisateurs',
  participantsTab: 'Participants',
  sessionsTab: 'Sessions',
  checkInsTab: 'Check-ins',
  feedbacksTab: 'Feedbacks',
  writeWebhookUrl: '',
  appSheetAppId: '',
  appSheetAccessKey: '',
  isLinked: false,
  autoSync: true,
};

function emptyState(): ServerState {
  return { version: 1, sheets: { ...DEFAULT_SERVER_SHEETS_CONFIG }, accounts: [] };
}

let state: ServerState = emptyState();

function readStateFromDisk(): ServerState {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ServerState>;

    return {
      version: 1,
      // Fusion avec les valeurs par defaut : un fichier ecrit par une version
      // anterieure peut ne pas contenir tous les champs.
      sheets: { ...DEFAULT_SERVER_SHEETS_CONFIG, ...(parsed.sheets || {}) },
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    };
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.warn('État serveur illisible, redémarrage sur un état vide :', error.message);
    }
    return emptyState();
  }
}

function writeStateToDisk() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  } catch (error: any) {
    console.error("Impossible d'enregistrer l'état serveur :", error.message);
  }
}

export function initStore() {
  state = readStateFromDisk();

  // Amorcage de demonstration : uniquement hors production, et uniquement si
  // aucun compte n'existe encore. Un deploiement reel part donc d'une table
  // vide, et le premier acces passe par ADMIN_EMAILS.
  if (state.accounts.length === 0 && process.env.NODE_ENV !== 'production') {
    state.accounts = INITIAL_USER_ACCOUNTS;
    writeStateToDisk();
    console.log(
      `Mode développement : ${state.accounts.length} compte(s) de démonstration amorcé(s). ` +
        "Aucun amorçage n'a lieu en production.",
    );
  }

  console.log(
    `État serveur chargé : classeur ${state.sheets.isLinked ? 'lié' : 'non lié'}, ` +
      `${state.accounts.length} compte(s) dans la table du serveur.`,
  );
}

/* ------------------------------------------------------------------ *
 * Configuration du classeur
 * ------------------------------------------------------------------ */

export function getSheetsConfig(): ServerSheetsConfig {
  return { ...state.sheets };
}

export function updateSheetsConfig(patch: Partial<ServerSheetsConfig>): ServerSheetsConfig {
  state.sheets = { ...state.sheets, ...patch };
  writeStateToDisk();
  return getSheetsConfig();
}

/** Vue publique : sans les secrets d'ecriture. */
export interface PublicSheetsConfig {
  masterSheetUrl: string;
  usersTab: string;
  participantsTab: string;
  sessionsTab: string;
  checkInsTab: string;
  feedbacksTab: string;
  isLinked: boolean;
  autoSync: boolean;
  lastSyncTimestamp?: string;
  lastError?: string;
  /** Indique qu'une voie d'ecriture existe, sans en reveler les identifiants. */
  canWrite: boolean;
  hasWebhook: boolean;
  hasAppSheetApi: boolean;
}

export function getPublicSheetsConfig(): PublicSheetsConfig {
  const config = state.sheets;
  const hasWebhook = config.writeWebhookUrl.trim() !== '';
  const hasAppSheetApi = config.appSheetAppId.trim() !== '' && config.appSheetAccessKey.trim() !== '';

  return {
    masterSheetUrl: config.masterSheetUrl,
    usersTab: config.usersTab,
    participantsTab: config.participantsTab,
    sessionsTab: config.sessionsTab,
    checkInsTab: config.checkInsTab,
    feedbacksTab: config.feedbacksTab,
    isLinked: config.isLinked,
    autoSync: config.autoSync,
    lastSyncTimestamp: config.lastSyncTimestamp,
    lastError: config.lastError,
    canWrite: hasWebhook || hasAppSheetApi,
    hasWebhook,
    hasAppSheetApi,
  };
}

export function hasWriteTarget(): boolean {
  const config = state.sheets;
  return (
    config.writeWebhookUrl.trim() !== '' ||
    (config.appSheetAppId.trim() !== '' && config.appSheetAccessKey.trim() !== '')
  );
}

/* ------------------------------------------------------------------ *
 * Table locale des comptes
 * ------------------------------------------------------------------ */

export function getAccounts(): UserAccount[] {
  return state.accounts.map(account => ({ ...account }));
}

/** Vue publique d'un compte : sans le code d'acces. */
export function toPublicAccount(account: UserAccount): Omit<UserAccount, 'accessCode'> & { hasAccessCode: boolean } {
  const { accessCode, ...rest } = account;
  return { ...rest, hasAccessCode: Boolean(accessCode) };
}

export function findAccount(email: string): UserAccount | undefined {
  const clean = normalizeEmail(email);
  return state.accounts.find(account => normalizeEmail(account.email) === clean);
}

export function upsertAccount(input: {
  email: string;
  name?: string;
  role: ParticipantRole;
  status?: AccountStatus;
  accessCode?: string;
  institution?: string;
  position?: string;
  ticketNumber?: string;
  avatarUrl?: string;
  assignedBy?: string;
}): UserAccount {
  const email = normalizeEmail(input.email);
  const existing = findAccount(email);

  const account: UserAccount = {
    email,
    name: input.name || existing?.name || email.split('@')[0].replace(/[._-]+/g, ' '),
    role: input.role,
    status: input.status || existing?.status || 'active',
    accessCode: input.accessCode !== undefined ? input.accessCode || undefined : existing?.accessCode,
    institution: input.institution ?? existing?.institution,
    position: input.position ?? existing?.position,
    ticketNumber: input.ticketNumber ?? existing?.ticketNumber,
    avatarUrl: input.avatarUrl ?? existing?.avatarUrl,
    assignedBy: input.assignedBy ?? existing?.assignedBy,
    assignedAt: new Date().toISOString(),
  };

  state.accounts = [account, ...state.accounts.filter(item => normalizeEmail(item.email) !== email)];
  writeStateToDisk();
  return account;
}

export function removeAccount(email: string): boolean {
  const clean = normalizeEmail(email);
  const before = state.accounts.length;
  state.accounts = state.accounts.filter(account => normalizeEmail(account.email) !== clean);

  if (state.accounts.length !== before) {
    writeStateToDisk();
    return true;
  }
  return false;
}

/** Remplace la table locale par les comptes lus dans le classeur. */
export function replaceAccounts(accounts: UserAccount[]): number {
  state.accounts = accounts;
  writeStateToDisk();
  return accounts.length;
}

/* ------------------------------------------------------------------ *
 * Emails administrateurs d'amorcage
 * ------------------------------------------------------------------ */

/**
 * Liste lue dans la variable d'environnement ADMIN_EMAILS, jamais depuis le
 * client : c'est elle qui permet le tout premier acces, avant qu'un classeur
 * ne soit lie. Sans elle, personne ne pourrait configurer l'application.
 */
export function getBootstrapAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter(email => email.includes('@'));
}

export function isBootstrapAdmin(email: string): boolean {
  const clean = normalizeEmail(email);
  return getBootstrapAdminEmails().includes(clean);
}

/** Utilitaires reexportes pour les routes. */
export { normalizeEmail, parseRole, parseStatus };
