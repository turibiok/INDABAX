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
  profilesTab: string;
  sessionsTab: string;
  checkInsTab: string;
  feedbacksTab: string;
  announcementsTab: string;
  messagesTab: string;
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
  profilesTab: 'Participants',
  sessionsTab: 'Sessions',
  checkInsTab: 'Check-ins',
  feedbacksTab: 'Feedbacks',
  announcementsTab: 'Annonces',
  messagesTab: 'Messages',
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

    // Fusion avec les valeurs par defaut : un fichier ecrit par une version
    // anterieure peut ne pas contenir tous les champs.
    const sheets = { ...DEFAULT_SERVER_SHEETS_CONFIG, ...(parsed.sheets || {}) };

    // Les onglets des comptes et de l'annuaire n'en font plus qu'un. Un etat
    // enregistre avant la fusion nomme encore les deux : reprendre le nom
    // choisi par l'organisateur evite de repartir sur « Participants » alors
    // que son onglet s'appelle autrement.
    const ancien = (parsed.sheets || {}) as Record<string, unknown>;
    if (!ancien.profilesTab) {
      const repris = ancien.participantsTab || ancien.usersTab;
      if (typeof repris === 'string' && repris.trim()) {
        sheets.profilesTab = repris.trim();
        console.log(`Onglet des profils repris de la configuration précédente : « ${sheets.profilesTab} ».`);
      }
    }

    return {
      version: 1,
      sheets,
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

  applyEnvSheetConfig();

  console.log(
    `État serveur chargé : classeur ${state.sheets.isLinked ? 'lié' : 'non lié'}, ` +
      `${state.accounts.length} compte(s) dans la table du serveur.`,
  );
}

/**
 * Applique la configuration du classeur décrite par l'environnement.
 *
 * Utile là où le disque n'est pas garanti d'un déploiement à l'autre : sur un
 * hébergement sans volume persistant, `.data/server-state.json` disparaît et
 * l'application repartirait sans classeur. Ces variables lui redonnent sa
 * configuration à chaque démarrage.
 *
 * Les valeurs déjà enregistrées gagnent : une modification faite depuis
 * l'application n'est jamais écrasée par l'environnement. C'est donc un
 * réglage initial, pas une contrainte permanente.
 */
function applyEnvSheetConfig() {
  const patch: Partial<ServerSheetsConfig> = {};

  const url = (process.env.SHEET_URL || '').trim();
  if (url && !state.sheets.masterSheetUrl.trim()) {
    patch.masterSheetUrl = url;
  }

  const tabs: [keyof ServerSheetsConfig, string | undefined][] = [
    // Les deux anciens noms restent acceptés : un déploiement en place ne
    // doit pas cesser de trouver son onglet à cause de la fusion.
    [
      'profilesTab',
      process.env.SHEET_PROFILES_TAB ||
        process.env.SHEET_PARTICIPANTS_TAB ||
        process.env.SHEET_USERS_TAB,
    ],
    ['announcementsTab', process.env.SHEET_ANNOUNCEMENTS_TAB],
    ['messagesTab', process.env.SHEET_MESSAGES_TAB],
    ['sessionsTab', process.env.SHEET_SESSIONS_TAB],
    ['checkInsTab', process.env.SHEET_CHECKINS_TAB],
    ['feedbacksTab', process.env.SHEET_FEEDBACKS_TAB],
  ];

  for (const [field, value] of tabs) {
    if (value && value.trim()) patch[field] = value.trim() as never;
  }

  // Secrets d'écriture : appliqués seulement si rien n'est encore enregistré.
  const webhook = (process.env.APPS_SCRIPT_URL || '').trim();
  if (webhook && !state.sheets.writeWebhookUrl.trim()) {
    patch.writeWebhookUrl = webhook;
  }

  const appId = (process.env.APPSHEET_APP_ID || '').trim();
  const accessKey = (process.env.APPSHEET_ACCESS_KEY || '').trim();
  if (appId && accessKey && !state.sheets.appSheetAppId.trim()) {
    patch.appSheetAppId = appId;
    patch.appSheetAccessKey = accessKey;
  }

  if (Object.keys(patch).length === 0) return;

  state.sheets = { ...state.sheets, ...patch };
  writeStateToDisk();

  console.log(
    `Configuration du classeur appliquée depuis l'environnement : ${Object.keys(patch).join(', ')}.`,
  );
}

/**
 * Vérifie le classeur configuré et charge ses comptes.
 *
 * Appelé au démarrage quand une URL est présente mais que la liaison n'est pas
 * encore confirmée : l'application se configure ainsi toute seule après un
 * déploiement, sans passage obligé par l'interface.
 */
export async function verifyConfiguredSheet(
  readUsers: () => Promise<UserAccount[]>,
): Promise<{ linked: boolean; accounts: number; error?: string }> {
  if (!state.sheets.masterSheetUrl.trim()) {
    return { linked: false, accounts: 0 };
  }

  try {
    const accounts = await readUsers();

    if (accounts.length === 0) {
      const error = `L'onglet « ${state.sheets.profilesTab} » ne contient aucun email exploitable.`;
      state.sheets = { ...state.sheets, isLinked: false, lastError: error };
      writeStateToDisk();
      return { linked: false, accounts: 0, error };
    }

    await replaceAccounts(accounts);
    state.sheets = {
      ...state.sheets,
      isLinked: true,
      lastSyncTimestamp: new Date().toISOString(),
      lastError: undefined,
    };
    writeStateToDisk();

    return { linked: true, accounts: accounts.length };
  } catch (error: any) {
    state.sheets = { ...state.sheets, isLinked: false, lastError: error.message };
    writeStateToDisk();
    return { linked: false, accounts: 0, error: error.message };
  }
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
  profilesTab: string;
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
    profilesTab: config.profilesTab,
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

/**
 * Efface le mot de passe d'un compte : il redevient « à activer ».
 *
 * C'est la réinitialisation par l'organisateur. La personne choisit ensuite
 * elle-même un nouveau mot de passe via l'inscription, sans que personne
 * n'ait eu à en connaître un.
 */
export function clearPassword(email: string): boolean {
  const clean = normalizeEmail(email);
  const account = state.accounts.find(item => normalizeEmail(item.email) === clean);
  if (!account) return false;

  delete account.passwordHash;
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
  const seen = new Set<string>();

  for (const account of incoming) {
    const email = normalizeEmail(account.email);
    const existing = findAccount(email);
    const { password, ...rest } = account;

    seen.add(email);
    merged.push({
      ...rest,
      email,
      passwordHash: password ? await hashPassword(password) : existing?.passwordHash,
    });
  }

  // Le compte administrateur décrit par l'environnement survit au remplacement.
  //
  // Sans cela, lier un classeur qui ne contient pas cet email l'effacerait de
  // la table, et la personne qui vient de configurer l'application perdrait
  // son accès au rechargement suivant — précisément au moment où elle en a le
  // plus besoin.
  const provisionedEmail = normalizeEmail(process.env.SUPERADMIN_EMAIL || '');
  if (provisionedEmail && !seen.has(provisionedEmail)) {
    const provisioned = findAccount(provisionedEmail);
    if (provisioned) merged.push(provisioned);
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

  const existing = findAccount(email);

  // Un compte de démonstration ne doit pas masquer le compte configuré : en
  // développement, l'amorçage s'exécute avant ce provisionnement, et l'email
  // choisi peut se trouver dans les données de démo. Sans cette exception, le
  // mot de passe du fichier .env serait silencieusement ignoré.
  const isDemoSeed = existing?.assignedBy === 'Amorcage initial';

  if (existing && !isDemoSeed) {
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
