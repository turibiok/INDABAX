import fs from 'fs';
import path from 'path';
import { AccountStatus, ParticipantRole, PublicUserAccount, UserAccount } from '../src/types';
import { normalizeEmail, parseRole, parseStatus } from '../src/lib/sheets';
import { DEMO_PASSWORD, INITIAL_USER_ACCOUNTS } from '../src/data/mockData';
import { hashPassword } from './passwords';

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

export async function initStore() {
  state = readStateFromDisk();

  // Amorcage de demonstration : uniquement hors production, et uniquement si
  // aucun compte n'existe encore. Un deploiement reel part donc d'une table
  // vide, et le premier acces passe par ADMIN_EMAILS.
  if (state.accounts.length === 0 && process.env.NODE_ENV !== 'production') {
    await replaceAccounts(INITIAL_USER_ACCOUNTS);
    console.log(
      `Mode développement : ${state.accounts.length} compte(s) de démonstration amorcé(s), ` +
        `mot de passe « ${DEMO_PASSWORD} ». Aucun amorçage n'a lieu en production.`,
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

/** Vue publique d'un compte : sans le mot de passe ni son empreinte. */
export function toPublicAccount(account: UserAccount): PublicUserAccount {
  const { password, passwordHash, ...rest } = account;
  return { ...rest, hasPassword: Boolean(passwordHash) };
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
  /** Empreinte deja calculee. Laisser vide conserve celle du compte existant. */
  passwordHash?: string;
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
    // Aucun mot de passe en clair n'est jamais conserve.
    passwordHash: input.passwordHash || existing?.passwordHash,
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

/** Remplace l'empreinte du mot de passe d'un compte existant. */
export function setPasswordHash(email: string, passwordHash: string): boolean {
  const clean = normalizeEmail(email);
  const account = state.accounts.find(item => normalizeEmail(item.email) === clean);
  if (!account) return false;

  account.passwordHash = passwordHash;
  delete account.password;
  writeStateToDisk();
  return true;
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

/**
 * Remplace la table locale par les comptes lus dans le classeur.
 *
 * Les mots de passe presents dans le classeur sont haches ici, puis oublies :
 * le fichier d'etat ne contient que des empreintes. Une ligne sans mot de passe
 * conserve l'empreinte deja enregistree, ce qui permet a un participant d'avoir
 * change le sien sans que l'admin ne l'ecrase a chaque rechargement.
 */
export async function replaceAccounts(incoming: UserAccount[]): Promise<number> {
  const merged: UserAccount[] = [];

  for (const account of incoming) {
    const email = normalizeEmail(account.email);
    const existing = findAccount(email);
    const { password, ...rest } = account;

    merged.push({
      ...rest,
      email,
      passwordHash: password ? await hashPassword(password) : existing?.passwordHash,
    });
  }

  state.accounts = merged;
  writeStateToDisk();
  return merged.length;
}

/**
 * Prepare un compte lu dans le classeur pour la verification du mot de passe :
 * renvoie l'empreinte a utiliser, en hachant au besoin le mot de passe du
 * classeur et en l'enregistrant pour les connexions suivantes.
 */
export async function resolvePasswordHash(account: UserAccount): Promise<string | undefined> {
  const email = normalizeEmail(account.email);
  const existing = findAccount(email);

  // Un mot de passe fraichement saisi dans le classeur prime : c'est ainsi que
  // l'organisateur reinitialise l'acces de quelqu'un.
  if (account.password) {
    const hash = await hashPassword(account.password);
    if (existing) setPasswordHash(email, hash);
    return hash;
  }

  return existing?.passwordHash;
}

/**
 * Cree le compte super-admin decrit par SUPERADMIN_EMAIL et SUPERADMIN_PASSWORD
 * s'il n'existe pas encore.
 *
 * L'operation est idempotente et ne touche jamais un compte deja present : un
 * mot de passe change depuis l'application n'est donc pas ecrase au
 * redemarrage. Pour le reinitialiser, retirez le compte puis redemarrez, ou
 * utilisez la reinitialisation depuis l'espace Super-Admin.
 */
export async function ensureSuperAdmin(): Promise<
  { created: false; reason: 'not_configured' | 'already_exists' } | { created: true; email: string }
> {
  const email = normalizeEmail(process.env.SUPERADMIN_EMAIL || '');
  const password = process.env.SUPERADMIN_PASSWORD || '';

  if (!email.includes('@') || !password) {
    return { created: false, reason: 'not_configured' };
  }

  if (findAccount(email)) {
    return { created: false, reason: 'already_exists' };
  }

  const name = (process.env.SUPERADMIN_NAME || email.split('@')[0].replace(/[._-]+/g, ' ')).trim();

  upsertAccount({
    email,
    name,
    role: 'super-admin',
    status: 'active',
    passwordHash: await hashPassword(password),
    assignedBy: 'Provisionnement au démarrage',
  });

  return { created: true, email };
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
