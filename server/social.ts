import crypto from 'crypto';

import { getSheetsConfig } from './store';
import { expectedHeadersFor, readTab, SheetError, writeRows } from './sheetsGateway';
import { normalizeHeader, parseRole, splitList, stripAccents } from '../src/lib/sheets';
import { ParticipantRole } from '../src/types';

/**
 * Annonces, discussions et commentaires.
 *
 * Ces trois usages étaient tenus dans le `localStorage` de chaque navigateur :
 * une annonce publiée par un organisateur n'atteignait donc personne, et un
 * salon de discussion était un monologue que son auteur seul pouvait relire.
 * Ils passent ici par le serveur, et le serveur les inscrit dans le classeur.
 *
 * Le classeur est la mémoire durable de l'application — l'hébergement retenu
 * ne garantit pas le disque d'un redémarrage à l'autre. Ce module en garde une
 * copie en mémoire pour ne pas relire le classeur à chaque affichage, et la
 * rafraîchit dès qu'elle a vieilli : un organisateur qui ajoute une ligne à la
 * main dans la feuille doit voir son annonce apparaître.
 *
 * Sans classeur lié, tout fonctionne en mémoire seule. C'est ce qui permet
 * d'essayer l'application avant de la brancher, au prix de l'oubli au
 * redémarrage.
 */

/* ------------------------------------------------------------------ *
 * Formes stockées
 * ------------------------------------------------------------------ */

export interface StoredAnnouncement {
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
  likedBy: string[];
}

export interface StoredMessage {
  id: string;
  timestamp: string;
  /** « canal:<id> » pour un salon, « annonce:<id> » pour un commentaire. */
  thread: string;
  authorName: string;
  authorEmail: string;
  authorRole: ParticipantRole;
  content: string;
  retired: boolean;
  likedBy: string[];
}

/** Catégories reconnues pour une annonce. */
const CATEGORIES = ['URGENT', 'PROGRAMME', 'LOGISTIQUE', 'KEYNOTE', 'SOCIAL', 'HACKATHON'] as const;
export type AnnouncementCategory = (typeof CATEGORIES)[number];

export function parseCategory(value: string): AnnouncementCategory {
  const clean = stripAccents(value || '')
    .trim()
    .toUpperCase();

  const found = CATEGORIES.find(category => category === clean);
  return found || 'PROGRAMME';
}

/* ------------------------------------------------------------------ *
 * Lecture des cellules
 * ------------------------------------------------------------------ */

function cell(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value !== undefined && value !== '') return value.trim();
  }
  return '';
}

/** Interprète oui / non, vrai / faux, true / false, 1 / 0. */
function parseFlag(value: string): boolean {
  const clean = stripAccents(value || '')
    .trim()
    .toLowerCase();

  return ['oui', 'vrai', 'true', '1', 'x', 'yes'].includes(clean);
}

/**
 * Lit un horodateur.
 *
 * L'application écrit en ISO 8601, qui se trie tel quel. Une ligne ajoutée à
 * la main porte plutôt une date à la française : elle est acceptée aussi,
 * sinon l'annonce d'un organisateur pressé se retrouverait sans date.
 */
export function parseTimestamp(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return new Date().toISOString();

  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return new Date(iso).toISOString();
  }

  const french = trimmed.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (french) {
    const [, day, month, year, hour, minute, second] = french;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour || 0),
      Number(minute || 0),
      Number(second || 0),
    );
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return Number.isNaN(iso) ? new Date().toISOString() : new Date(iso).toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

/* ------------------------------------------------------------------ *
 * Copie en mémoire
 * ------------------------------------------------------------------ */

interface Cache<T> {
  items: T[];
  loadedAt: number;
  /** Vrai dès qu'une lecture du classeur a réussi. */
  fromSheet: boolean;
}

/** Au-delà, la copie est relue : une modification directe doit se voir. */
const FRESH_FOR_MS = 30_000;

const announcements: Cache<StoredAnnouncement> = { items: [], loadedAt: 0, fromSheet: false };
const messages: Cache<StoredMessage> = { items: [], loadedAt: 0, fromSheet: false };

/** Vide les copies : à appeler quand le classeur change. */
export function forgetSocialCache(): void {
  announcements.items = [];
  announcements.loadedAt = 0;
  announcements.fromSheet = false;
  messages.items = [];
  messages.loadedAt = 0;
  messages.fromSheet = false;
}

function mapAnnouncementRow(row: Record<string, string>): StoredAnnouncement | null {
  const content = cell(row, 'Message', 'Contenu', 'Texte', 'Corps');
  const title = cell(row, 'Titre', 'Title', 'Objet');
  if (!content && !title) return null;

  return {
    id: cell(row, 'ID', 'Identifiant') || newId('ann'),
    timestamp: parseTimestamp(cell(row, 'Horodateur', 'Date', 'Publie le')),
    category: parseCategory(cell(row, 'Categorie', 'Type', 'Priorite')),
    title: title || content.slice(0, 60),
    content: content || title,
    authorName: cell(row, 'Auteur', 'Author', 'Publie par') || 'Organisation',
    authorEmail: cell(row, 'Email auteur', 'Email'),
    authorRole: parseRole(cell(row, 'Role')),
    pinned: parseFlag(cell(row, 'Epingle', 'Pinned', 'Important')),
    retired: parseFlag(cell(row, 'Retire', 'Supprime', 'Masque')),
    likedBy: splitList(cell(row, 'Reactions', 'Jaime', 'Likes')),
  };
}

function mapMessageRow(row: Record<string, string>): StoredMessage | null {
  const content = cell(row, 'Message', 'Contenu', 'Texte');
  if (!content) return null;

  const role = cell(row, 'Role');

  return {
    id: cell(row, 'ID', 'Identifiant') || newId('msg'),
    timestamp: parseTimestamp(cell(row, 'Horodateur', 'Date', 'Envoye le')),
    thread: cell(row, 'Fil', 'Thread', 'Canal', 'Salon') || 'canal:general',
    authorName: cell(row, 'Auteur', 'Author', 'Nom') || 'Participant',
    authorEmail: cell(row, 'Email auteur', 'Email'),
    authorRole: parseRole(role),
    content,
    retired: parseFlag(cell(row, 'Retire', 'Supprime', 'Masque')),
    likedBy: splitList(cell(row, 'Reactions', 'Jaime', 'Likes')),
  };
}

/**
 * Relit un onglet si la copie a vieilli.
 *
 * Un échec de lecture n'efface pas la copie en mémoire : mieux vaut afficher
 * des annonces d'il y a une minute que rien du tout parce que Google a répondu
 * lentement.
 */
async function refresh<T>(
  cache: Cache<T>,
  tab: string,
  kind: 'announcements' | 'messages',
  map: (row: Record<string, string>) => T | null,
): Promise<void> {
  const config = getSheetsConfig();
  if (!config.isLinked) return;

  if (cache.fromSheet && Date.now() - cache.loadedAt < FRESH_FOR_MS) return;

  try {
    const table = await readTab(tab, undefined, expectedHeadersFor(kind));
    const items: T[] = [];

    for (const row of table.rows) {
      const item = map(row);
      if (item) items.push(item);
    }

    cache.items = items;
    cache.loadedAt = Date.now();
    cache.fromSheet = true;
  } catch (error: any) {
    const detail = error instanceof SheetError ? error.message : String(error?.message || error);

    // L'onglet peut ne pas exister encore : ce n'est pas une panne, seulement
    // un classeur incomplet. On le dit une fois, puis on laisse la copie
    // vivre en mémoire.
    if (!cache.fromSheet && cache.loadedAt === 0) {
      console.warn(`Onglet « ${tab} » non lu (${detail}). Les publications restent en mémoire.`);
    }
    cache.loadedAt = Date.now();
  }
}

/* ------------------------------------------------------------------ *
 * Lecture
 * ------------------------------------------------------------------ */

export async function listAnnouncements(): Promise<StoredAnnouncement[]> {
  await refresh(announcements, getSheetsConfig().announcementsTab, 'announcements', mapAnnouncementRow);

  return announcements.items
    .filter(item => !item.retired)
    .slice()
    .sort((a, b) => {
      // Les annonces épinglées passent devant, puis la plus récente d'abord.
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.timestamp.localeCompare(a.timestamp);
    });
}

export async function listMessages(thread?: string): Promise<StoredMessage[]> {
  await refresh(messages, getSheetsConfig().messagesTab, 'messages', mapMessageRow);

  return messages.items
    .filter(item => !item.retired && (!thread || item.thread === thread))
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Nombre de messages par fil, pour afficher les compteurs sans tout charger. */
export async function countByThread(): Promise<Record<string, number>> {
  await refresh(messages, getSheetsConfig().messagesTab, 'messages', mapMessageRow);

  const counts: Record<string, number> = {};
  for (const message of messages.items) {
    if (message.retired) continue;
    counts[message.thread] = (counts[message.thread] || 0) + 1;
  }
  return counts;
}

/* ------------------------------------------------------------------ *
 * Écriture
 * ------------------------------------------------------------------ */

/**
 * Écrit dans le classeur si c'est possible, sans faire échouer la
 * publication sinon : le message est déjà en mémoire et visible de tous les
 * appareils connectés à ce serveur. Ce qui manque, c'est sa survie au
 * redémarrage, et cela se signale.
 */
async function persist(
  tab: string,
  row: Record<string, unknown>,
  keyColumn?: string,
): Promise<string | undefined> {
  const config = getSheetsConfig();

  if (!config.isLinked) {
    return 'Aucun classeur lié : cette publication ne survivra pas au redémarrage du serveur.';
  }

  if (!config.writeWebhookUrl.trim() && !config.appSheetAppId.trim()) {
    return "Aucune voie d'écriture configurée : cette publication ne survivra pas au redémarrage du serveur.";
  }

  try {
    await writeRows(tab, [row], keyColumn ? { keyColumn } : {});
    return undefined;
  } catch (error: any) {
    const detail = error instanceof SheetError ? error.message : String(error?.message || error);
    console.warn(`Publication non écrite dans « ${tab} » : ${detail}`);
    return `Le classeur n’a pas pu être mis à jour (${detail})`;
  }
}

export interface Author {
  email: string;
  name: string;
  role: ParticipantRole;
}

export async function postAnnouncement(
  author: Author,
  input: { title: string; content: string; category: string; pinned?: boolean },
): Promise<{ announcement: StoredAnnouncement; warning?: string }> {
  const announcement: StoredAnnouncement = {
    id: newId('ann'),
    timestamp: new Date().toISOString(),
    category: parseCategory(input.category),
    title: input.title.trim(),
    content: input.content.trim(),
    authorName: author.name,
    authorEmail: author.email,
    authorRole: author.role,
    pinned: Boolean(input.pinned),
    retired: false,
    likedBy: [],
  };

  announcements.items.push(announcement);

  const warning = await persist(getSheetsConfig().announcementsTab, {
    ID: announcement.id,
    Horodateur: announcement.timestamp,
    Categorie: announcement.category,
    Titre: announcement.title,
    Message: announcement.content,
    Auteur: announcement.authorName,
    'Email auteur': announcement.authorEmail,
    Role: announcement.authorRole,
    Epingle: announcement.pinned ? 'oui' : '',
    Retire: '',
    Reactions: '',
  });

  return { announcement, warning };
}

export async function postMessage(
  author: Author,
  input: { thread: string; content: string },
): Promise<{ message: StoredMessage; warning?: string }> {
  const message: StoredMessage = {
    id: newId('msg'),
    timestamp: new Date().toISOString(),
    thread: input.thread.trim(),
    authorName: author.name,
    authorEmail: author.email,
    authorRole: author.role,
    content: input.content.trim(),
    retired: false,
    likedBy: [],
  };

  messages.items.push(message);

  const warning = await persist(getSheetsConfig().messagesTab, {
    ID: message.id,
    Horodateur: message.timestamp,
    Fil: message.thread,
    Auteur: message.authorName,
    'Email auteur': message.authorEmail,
    Role: message.authorRole,
    Message: message.content,
    Retire: '',
    Reactions: '',
  });

  return { message, warning };
}

/* ------------------------------------------------------------------ *
 * Modifications sur place
 * ------------------------------------------------------------------ */

export function findAnnouncement(id: string): StoredAnnouncement | undefined {
  return announcements.items.find(item => item.id === id);
}

export function findMessage(id: string): StoredMessage | undefined {
  return messages.items.find(item => item.id === id);
}

/** Épingle ou désépingle une annonce. */
export async function setPinned(id: string, pinned: boolean): Promise<{ warning?: string }> {
  const announcement = findAnnouncement(id);
  if (!announcement) throw new SheetError('Annonce introuvable.', 404, 'not_found');

  announcement.pinned = pinned;

  const warning = await persist(
    getSheetsConfig().announcementsTab,
    { ID: id, Epingle: pinned ? 'oui' : '' },
    'ID',
  );
  return { warning };
}

/**
 * Retire une annonce ou un message.
 *
 * La ligne n'est pas effacée : elle est marquée. Ce qui a été dit à
 * l'événement reste consultable dans le classeur, ce qui vaut mieux qu'une
 * suppression irréversible déclenchée d'un clic.
 */
export async function retire(kind: 'announcement' | 'message', id: string): Promise<{ warning?: string }> {
  const config = getSheetsConfig();

  if (kind === 'announcement') {
    const announcement = findAnnouncement(id);
    if (!announcement) throw new SheetError('Annonce introuvable.', 404, 'not_found');
    announcement.retired = true;

    return { warning: await persist(config.announcementsTab, { ID: id, Retire: 'oui' }, 'ID') };
  }

  const message = findMessage(id);
  if (!message) throw new SheetError('Message introuvable.', 404, 'not_found');
  message.retired = true;

  return { warning: await persist(config.messagesTab, { ID: id, Retire: 'oui' }, 'ID') };
}

/** Ajoute ou retire la mention « j'aime » d'une personne sur une annonce. */
export async function toggleLike(
  id: string,
  email: string,
): Promise<{ liked: boolean; likes: number; warning?: string }> {
  const announcement = findAnnouncement(id);
  if (!announcement) throw new SheetError('Annonce introuvable.', 404, 'not_found');

  const index = announcement.likedBy.indexOf(email);
  const liked = index < 0;

  if (liked) announcement.likedBy.push(email);
  else announcement.likedBy.splice(index, 1);

  const warning = await persist(
    getSheetsConfig().announcementsTab,
    { ID: id, Reactions: announcement.likedBy.join('; ') },
    'ID',
  );

  return { liked, likes: announcement.likedBy.length, warning };
}

/** Prépare la copie en mémoire au démarrage, sans bloquer le serveur. */
export async function warmSocialCache(): Promise<void> {
  const config = getSheetsConfig();
  if (!config.isLinked) return;

  await Promise.all([
    refresh(announcements, config.announcementsTab, 'announcements', mapAnnouncementRow),
    refresh(messages, config.messagesTab, 'messages', mapMessageRow),
  ]);

  console.log(
    `Publications chargées : ${announcements.items.length} annonce(s), ${messages.items.length} message(s).`,
  );
}
