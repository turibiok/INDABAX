import {
  Announcement,
  AnnouncementCategory,
  CheckInRecord,
  Participant,
  Session,
  SessionFeedback,
  SessionTrack,
  SessionType,
  SheetsLinkConfig,
  UserAccount,
} from '../types';
import { mapUserAccounts, parseRole, pick, SheetTable } from '../lib/sheets';

/**
 * Accès à la base de données Google Sheet (le classeur qui alimente AppSheet).
 *
 * Aucune clé d'API, aucun projet Google Cloud, aucun Firebase :
 * seul le LIEN de partage du classeur est nécessaire. La lecture passe par
 * le relais `/api/sheets/read` du serveur de l'application, ce qui évite les
 * restrictions CORS du navigateur.
 */

export const DEFAULT_SHEETS_CONFIG: SheetsLinkConfig = {
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

export class SheetsDbError extends Error {
  reason?: string;

  constructor(message: string, reason?: string) {
    super(message);
    this.name = 'SheetsDbError';
    this.reason = reason;
  }
}

async function postJson<T>(endpoint: string, payload: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new SheetsDbError(
      "Le serveur de l'application est injoignable. Vérifiez votre connexion.",
      'network',
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SheetsDbError(
      (data as any)?.error || `La requête a échoué (HTTP ${response.status}).`,
      (data as any)?.reason,
    );
  }

  return data as T;
}

/** Lit un onglet du classeur lié. */
export async function readTab(config: SheetsLinkConfig, tab?: string): Promise<SheetTable> {
  if (!config.masterSheetUrl.trim()) {
    throw new SheetsDbError(
      'Aucun classeur Google Sheet lié. Un administrateur doit renseigner le lien dans les paramètres.',
      'not_linked',
    );
  }

  const data = await postJson<{ headers: string[]; rows: Record<string, string>[] }>(
    '/api/sheets/read',
    { sheetUrl: config.masterSheetUrl, tab },
  );

  return { headers: data.headers || [], rows: data.rows || [] };
}

/** Charge la table des comptes : c'est elle qui porte les rôles attribués par l'admin. */
export async function loadUserAccounts(config: SheetsLinkConfig): Promise<UserAccount[]> {
  const table = await readTab(config, config.usersTab);
  return mapUserAccounts(table);
}

const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80';

/** Convertit une ligne de l'onglet Participants en participant applicatif. */
function mapParticipant(row: Record<string, string>, index: number): Participant | null {
  const email = pick(row, 'email', 'adresse email', 'mail', 'courriel').toLowerCase();
  const name = pick(row, 'name', 'nom', 'nom complet', 'participant');

  if (!email && !name) return null;

  const interests = pick(row, 'interests', 'centres interet', "centres d'interet", 'interet', 'tags');

  return {
    id: pick(row, 'id', 'identifiant') || `sheet-usr-${index + 1}`,
    ticketNumber:
      pick(row, 'ticket', 'ticket number', 'billet', 'numero billet', 'badge') ||
      `INDABAX-BJ-2026-${String(index + 1).padStart(3, '0')}`,
    name: name || email.split('@')[0],
    email,
    role: parseRole(pick(row, 'role', 'profil', 'fonction', 'type')),
    institution: pick(row, 'institution', 'organisation', 'structure', 'universite') || 'Non renseigné',
    position: pick(row, 'position', 'poste', 'titre') || 'Participant',
    country: pick(row, 'country', 'pays') || 'Bénin',
    city: pick(row, 'city', 'ville') || 'Cotonou',
    avatarUrl: pick(row, 'avatar', 'avatar url', 'photo', 'photo url') || FALLBACK_AVATAR,
    bio: pick(row, 'bio', 'presentation', 'description') || '',
    interests: interests
      ? interests
          .split(/[;,|]/)
          .map(value => value.trim())
          .filter(Boolean)
      : [],
    github: pick(row, 'github') || undefined,
    linkedin: pick(row, 'linkedin') || undefined,
    twitter: pick(row, 'twitter', 'x') || undefined,
    phone: pick(row, 'phone', 'telephone', 'tel') || undefined,
    checkedInSessions: [],
  };
}

export async function loadParticipants(config: SheetsLinkConfig): Promise<Participant[]> {
  const table = await readTab(config, config.participantsTab);

  return table.rows
    .map((row, index) => mapParticipant(row, index))
    .filter((participant): participant is Participant => participant !== null);
}

const KNOWN_TRACKS: SessionTrack[] = [
  'NLP & Langues Africaines',
  'Computer Vision & Santé',
  'Fondamentaux ML',
  'Generative AI & LLMs',
  'Entrepreneuriat & Éthique',
  'Keynote',
];

const KNOWN_TYPES: SessionType[] = [
  'Keynote',
  'Workshop',
  'Paper Presentation',
  'Panel',
  'Hackathon',
  'Networking',
];

const KNOWN_LEVELS: Session['level'][] = ['Débutant', 'Intermédiaire', 'Avancé', 'Tous niveaux'];

function matchOption<T extends string>(raw: string, options: T[], fallback: T): T {
  if (!raw) return fallback;
  const needle = raw.trim().toLowerCase();
  return options.find(option => option.toLowerCase() === needle) || fallback;
}

/** Convertit une ligne de l'onglet Sessions en session applicative. */
function mapSession(row: Record<string, string>, index: number): Session | null {
  const title = pick(row, 'title', 'titre', 'session', 'intitule');
  if (!title) return null;

  const capacity = Number(pick(row, 'capacity', 'capacite', 'places')) || 50;

  return {
    id: pick(row, 'id', 'identifiant') || `sheet-ses-${index + 1}`,
    title,
    speaker: pick(row, 'speaker', 'conferencier', 'intervenant', 'orateur') || 'À confirmer',
    speakerTitle: pick(row, 'speaker title', 'titre intervenant', 'fonction intervenant') || '',
    speakerInstitution: pick(row, 'speaker institution', 'institution', 'organisation') || '',
    speakerPhoto: pick(row, 'speaker photo', 'photo intervenant', 'photo') || FALLBACK_AVATAR,
    day: Number(pick(row, 'day', 'jour')) || 1,
    date: pick(row, 'date') || '',
    startTime: pick(row, 'start time', 'heure debut', 'debut', 'horaire debut') || '09:00',
    endTime: pick(row, 'end time', 'heure fin', 'fin', 'horaire fin') || '10:00',
    room: pick(row, 'room', 'salle', 'lieu') || 'À préciser',
    track: matchOption(pick(row, 'track', 'thematique', 'theme'), KNOWN_TRACKS, 'Fondamentaux ML'),
    type: matchOption(pick(row, 'type', 'format'), KNOWN_TYPES, 'Workshop'),
    level: matchOption(pick(row, 'level', 'niveau'), KNOWN_LEVELS, 'Tous niveaux'),
    description: pick(row, 'description', 'resume', 'abstract') || '',
    prerequisites: pick(row, 'prerequisites', 'prerequis') || undefined,
    resourcesUrl: pick(row, 'resources url', 'ressources', 'lien ressources') || undefined,
    slidesUrl: pick(row, 'slides url', 'slides', 'presentation') || undefined,
    capacity,
    currentAttendees: Number(pick(row, 'current attendees', 'presences', 'inscrits')) || 0,
  };
}

export async function loadSessions(config: SheetsLinkConfig): Promise<Session[]> {
  const table = await readTab(config, config.sessionsTab);

  return table.rows
    .map((row, index) => mapSession(row, index))
    .filter((session): session is Session => session !== null);
}

const KNOWN_CATEGORIES: AnnouncementCategory[] = [
  'URGENT',
  'PROGRAMME',
  'LOGISTIQUE',
  'KEYNOTE',
  'SOCIAL',
  'HACKATHON',
];

/** Convertit une ligne d'onglet Annonces en annonce applicative. */
export function mapAnnouncementRow(row: Record<string, string>, index: number): Announcement | null {
  const title = pick(row, 'title', 'titre', 'annonce');
  if (!title) return null;

  const rawCategory = pick(row, 'category', 'categorie').toUpperCase();
  const rawPriority = pick(row, 'priority', 'priorite').toLowerCase();

  return {
    id: pick(row, 'id') || `sheet-ann-${index + 1}`,
    title,
    content: pick(row, 'content', 'contenu', 'message', 'texte'),
    category: (KNOWN_CATEGORIES.includes(rawCategory as AnnouncementCategory)
      ? rawCategory
      : 'PROGRAMME') as AnnouncementCategory,
    priority: (['normal', 'high', 'urgent'].includes(rawPriority) ? rawPriority : 'normal') as Announcement['priority'],
    authorName: pick(row, 'author', 'auteur') || 'Comité IndabaX Bénin',
    authorRole: parseRole(pick(row, 'author role', 'role auteur'), 'organizer'),
    authorAvatar: pick(row, 'author avatar', 'avatar') || FALLBACK_AVATAR,
    timestamp: pick(row, 'timestamp', 'date', 'horodateur') || new Date().toISOString(),
    pinned: ['oui', 'yes', 'true', '1'].includes(pick(row, 'pinned', 'epingle').toLowerCase()),
    likes: 0,
    likedBy: [],
    comments: [],
    targetAudience: 'all',
  };
}

/* ------------------------------------------------------------------ *
 * Écriture (optionnelle)
 * ------------------------------------------------------------------ */

export function hasWriteTarget(config: SheetsLinkConfig): boolean {
  return Boolean(
    config.writeWebhookUrl.trim() || (config.appSheetAppId.trim() && config.appSheetAccessKey.trim()),
  );
}

async function appendRows(
  config: SheetsLinkConfig,
  table: string,
  rows: Record<string, unknown>[],
): Promise<boolean> {
  if (!hasWriteTarget(config) || rows.length === 0) return false;

  try {
    await postJson('/api/sheets/write', {
      webhookUrl: config.writeWebhookUrl.trim() || undefined,
      appSheet:
        config.appSheetAppId.trim() && config.appSheetAccessKey.trim()
          ? { appId: config.appSheetAppId.trim(), accessKey: config.appSheetAccessKey.trim() }
          : undefined,
      table,
      rows,
    });
    return true;
  } catch (error) {
    console.warn(`Écriture dans l'onglet "${table}" impossible :`, error);
    return false;
  }
}

/** Pousse une présence dans le classeur (si une voie d'écriture est configurée). */
export function appendCheckIn(config: SheetsLinkConfig, record: CheckInRecord): Promise<boolean> {
  return appendRows(config, config.checkInsTab, [
    {
      Horodateur: new Date(record.timestamp).toLocaleString('fr-FR'),
      Nom: record.participantName,
      Email: record.participantEmail,
      Billet: record.ticketNumber,
      SessionID: record.sessionId,
      Session: record.sessionTitle,
      Salle: record.room,
      'Scanne par': record.scannedBy,
    },
  ]);
}

/** Pousse un feedback dans le classeur (si une voie d'écriture est configurée). */
export function appendFeedback(config: SheetsLinkConfig, feedback: SessionFeedback): Promise<boolean> {
  return appendRows(config, config.feedbacksTab, [
    {
      Horodateur: new Date(feedback.timestamp).toLocaleString('fr-FR'),
      Session: feedback.sessionTitle,
      Nom: feedback.participantName,
      'Note globale': feedback.overallRating,
      'Qualite contenu': feedback.contentQuality,
      'Clarte orateur': feedback.speakerClarity,
      'Utilite pratique': feedback.practicalRelevance,
      Commentaires: feedback.comments,
      Question: feedback.questionForSpeaker || '',
    },
  ]);
}

/** Écrit (ou met à jour) l'attribution de rôle d'un email dans l'onglet des comptes. */
export function appendRoleAssignment(
  config: SheetsLinkConfig,
  account: UserAccount,
  assignedBy: string,
): Promise<boolean> {
  return appendRows(config, config.usersTab, [
    {
      Email: account.email,
      Nom: account.name,
      Role: account.role,
      Statut: account.status,
      Institution: account.institution || '',
      Poste: account.position || '',
      'Attribue par': assignedBy,
      'Date attribution': new Date().toISOString(),
    },
  ]);
}

/** Vérifie qu'un lien de classeur est lisible et renvoie un résumé. */
export async function testConnection(
  config: SheetsLinkConfig,
): Promise<{ ok: true; accounts: number; headers: string[] }> {
  const table = await readTab(config, config.usersTab);
  const accounts = mapUserAccounts(table);

  if (table.rows.length === 0) {
    throw new SheetsDbError(
      `L'onglet "${config.usersTab}" est vide. Ajoutez au moins les colonnes Email, Nom, Role.`,
      'empty',
    );
  }

  if (accounts.length === 0) {
    // Google renvoie le premier onglet du classeur quand le nom demandé n'existe
    // pas : une table sans colonne Email signale donc souvent un nom d'onglet erroné.
    throw new SheetsDbError(
      `Aucune colonne « Email » exploitable dans l'onglet « ${config.usersTab} ». ` +
        `Vérifiez l'orthographe exacte du nom de l'onglet, puis ses colonnes. ` +
        `Colonnes lues : ${table.headers.filter(Boolean).join(', ') || 'aucune'}.`,
      'no_accounts',
    );
  }

  return { ok: true, accounts: accounts.length, headers: table.headers };
}

/* ------------------------------------------------------------------ *
 * Modèle de classeur / Apps Script à fournir aux organisateurs
 * ------------------------------------------------------------------ */

/** En-têtes attendus pour chaque onglet du classeur. */
export const SHEET_TEMPLATE_HEADERS: Record<string, string[]> = {
  Utilisateurs: ['Email', 'Nom', 'Role', 'Statut', 'Code', 'Institution', 'Poste', 'Attribue par', 'Date attribution'],
  Participants: ['ID', 'Billet', 'Nom', 'Email', 'Role', 'Institution', 'Poste', 'Pays', 'Ville', 'Interets'],
  Sessions: ['ID', 'Titre', 'Conferencier', 'Institution', 'Jour', 'Date', 'Heure debut', 'Heure fin', 'Salle', 'Track', 'Type', 'Niveau', 'Capacite', 'Description'],
  'Check-ins': ['Horodateur', 'Nom', 'Email', 'Billet', 'SessionID', 'Session', 'Salle', 'Scanne par'],
  Feedbacks: ['Horodateur', 'Session', 'Nom', 'Note globale', 'Qualite contenu', 'Clarte orateur', 'Utilite pratique', 'Commentaires', 'Question'],
};

/**
 * Script à coller dans le classeur (Extensions > Apps Script), puis à déployer
 * en « Application Web » accessible à tout le monde. Son URL se colle ensuite
 * dans le champ « Apps Script » des paramètres de l'application.
 */
export const APPS_SCRIPT_SNIPPET = `function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(payload.table);

  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(payload.table);
  }

  var headers = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];

  payload.rows.forEach(function (row) {
    if (headers.length === 0) {
      headers = Object.keys(row);
      sheet.appendRow(headers);
    }
    sheet.appendRow(headers.map(function (header) {
      return row[header] !== undefined ? row[header] : '';
    }));
  });

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, written: payload.rows.length }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
