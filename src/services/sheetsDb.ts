import {
  Announcement,
  AnnouncementCategory,
  Participant,
  Session,
  SessionTrack,
  SessionType,
} from '../types';
import { parseRole, pick } from '../lib/sheets';

/**
 * Conversion des lignes du classeur Google Sheet en objets de l'application.
 *
 * Ce module ne parle jamais au réseau : les lignes lui sont fournies par
 * `src/services/api.ts`, qui les obtient du serveur. Le serveur seul connaît
 * le lien du classeur.
 */

const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80';

/* ------------------------------------------------------------------ *
 * Participants
 * ------------------------------------------------------------------ */

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

export function rowsToParticipants(rows: Record<string, string>[]): Participant[] {
  return rows
    .map((row, index) => mapParticipant(row, index))
    .filter((participant): participant is Participant => participant !== null);
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

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

function mapSession(row: Record<string, string>, index: number): Session | null {
  const title = pick(row, 'title', 'titre', 'session', 'intitule');
  if (!title) return null;

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
    capacity: Number(pick(row, 'capacity', 'capacite', 'places')) || 50,
    currentAttendees: Number(pick(row, 'current attendees', 'presences', 'inscrits')) || 0,
  };
}

export function rowsToSessions(rows: Record<string, string>[]): Session[] {
  return rows
    .map((row, index) => mapSession(row, index))
    .filter((session): session is Session => session !== null);
}

/* ------------------------------------------------------------------ *
 * Annonces
 * ------------------------------------------------------------------ */

const KNOWN_CATEGORIES: AnnouncementCategory[] = [
  'URGENT',
  'PROGRAMME',
  'LOGISTIQUE',
  'KEYNOTE',
  'SOCIAL',
  'HACKATHON',
];

function mapAnnouncement(row: Record<string, string>, index: number): Announcement | null {
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
    priority: (['normal', 'high', 'urgent'].includes(rawPriority)
      ? rawPriority
      : 'normal') as Announcement['priority'],
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

export function rowsToAnnouncements(rows: Record<string, string>[]): Announcement[] {
  return rows
    .map((row, index) => mapAnnouncement(row, index))
    .filter((announcement): announcement is Announcement => announcement !== null);
}

/* ------------------------------------------------------------------ *
 * Modèle de classeur à fournir aux organisateurs
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
 * dans le champ « Apps Script » des paramètres, où elle reste côté serveur.
 */
export const APPS_SCRIPT_SNIPPET = `/** Normalise un nom d'onglet : sans accents, sans ponctuation, en minuscules. */
function normalize(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Retrouve un onglet même si son nom diffère par la casse, les accents, les
 * espaces ou un tiret : « Check-ins », « check ins » et « Checkins » désignent
 * le même onglet. Sans cette tolérance, le script créerait un doublon à côté
 * de l'onglet que vous regardez, et vos écritures sembleraient disparaître.
 */
function findSheet(spreadsheet, wanted) {
  var target = normalize(wanted);
  var sheets = spreadsheet.getSheets();

  for (var i = 0; i < sheets.length; i++) {
    if (normalize(sheets[i].getName()) === target) return sheets[i];
  }
  return null;
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);

  // Envoi d'email : sert aux liens de réinitialisation de mot de passe.
  // Le mail part de votre compte Google, sans service tiers.
  if (payload.action === 'email') {
    try {
      MailApp.sendEmail({
        to: payload.to,
        subject: payload.subject,
        body: payload.body
      });
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, sent: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(spreadsheet, payload.table);
  var created = false;

  if (!sheet) {
    sheet = spreadsheet.insertSheet(payload.table);
    created = true;
  }

  var headers = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];

  /** Retrouve une colonne par son en-tête, à la tolérance près. */
  function columnIndex(wanted) {
    var target = normalize(wanted);
    for (var i = 0; i < headers.length; i++) {
      if (normalize(headers[i]) === target) return i;
    }
    return -1;
  }

  // Colonne clé : quand elle est fournie, une ligne dont la clé existe déjà
  // est corrigée sur place au lieu d'être ajoutée. C'est ce qui garde une
  // seule ligne par personne dans l'onglet des participants.
  var keyIndex = payload.keyColumn ? columnIndex(payload.keyColumn) : -1;
  var existing = {};

  if (keyIndex >= 0 && sheet.getLastRow() > 1) {
    var keys = sheet.getRange(2, keyIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    for (var k = 0; k < keys.length; k++) {
      var value = String(keys[k][0]).trim().toLowerCase();
      // La première ligne trouvée gagne : un doublon éventuel n'est pas touché.
      if (value && existing[value] === undefined) existing[value] = k + 2;
    }
  }

  var added = 0;
  var updated = 0;

  payload.rows.forEach(function (row) {
    if (headers.length === 0) {
      headers = Object.keys(row);
      sheet.appendRow(headers);
      if (payload.keyColumn) keyIndex = columnIndex(payload.keyColumn);
    }

    var key = keyIndex >= 0 && row[headers[keyIndex]] !== undefined
      ? String(row[headers[keyIndex]]).trim().toLowerCase()
      : '';
    var line = key ? existing[key] : undefined;

    if (line) {
      // Mise à jour : seules les colonnes présentes dans la ligne envoyée
      // sont touchées. Le reste du profil, saisi à la main, est préservé.
      for (var c = 0; c < headers.length; c++) {
        if (row[headers[c]] === undefined) continue;
        sheet.getRange(line, c + 1).setValue(row[headers[c]]);
      }
      updated++;
      return;
    }

    sheet.appendRow(headers.map(function (header) {
      return row[header] !== undefined ? row[header] : '';
    }));
    if (key) existing[key] = sheet.getLastRow();
    added++;
  });

  // Le nom réel de l'onglet est renvoyé : l'application peut ainsi signaler
  // qu'elle a écrit ailleurs que prévu.
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      written: payload.rows.length,
      added: added,
      updated: updated,
      sheet: sheet.getName(),
      created: created
    }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
