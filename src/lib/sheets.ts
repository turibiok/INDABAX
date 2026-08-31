import { AccountStatus, ParticipantRole, UserAccount } from '../types';

/* ------------------------------------------------------------------ *
 * 1. Analyse des liens Google
 * ------------------------------------------------------------------ */

/** Hotes autorises pour les appels sortants (protection anti-SSRF du proxy). */
export const ALLOWED_HOSTS = [
  'docs.google.com',
  'script.google.com',
  'script.googleusercontent.com',
  'api.appsheet.com',
  'www.appsheet.com',
];

export function isAllowedGoogleUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Extrait l'identifiant du classeur depuis n'importe quel lien Google Sheets :
 *  - https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
 *  - https://docs.google.com/spreadsheets/d/e/<ID>/pubhtml  (classeur publie)
 *  - un ID brut colle directement
 */
export function extractSpreadsheetId(input: string): string | null {
  if (!input) return null;
  const value = input.trim();

  const publishedMatch = value.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (publishedMatch) return `e/${publishedMatch[1]}`;

  const editMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (editMatch) return editMatch[1];

  // ID colle sans URL : suite de caracteres autorises, assez longue.
  if (/^[a-zA-Z0-9-_]{25,}$/.test(value)) return value;

  return null;
}

/** Extrait le gid (identifiant numerique de l'onglet) d'un lien Google Sheets. */
export function extractGid(input: string): string | null {
  if (!input) return null;
  const match = input.match(/[#&?]gid=([0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Construit l'URL d'export CSV d'un onglet.
 * L'endpoint `gviz/tq` fonctionne des que le classeur est partage
 * en lecture ("Tous les utilisateurs disposant du lien").
 */
export function buildCsvUrl(
  spreadsheetId: string,
  options: { tab?: string; gid?: string | null } = {},
): string {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`;
  const params = new URLSearchParams({ tqx: 'out:csv' });

  if (options.gid) {
    params.set('gid', options.gid);
  } else if (options.tab) {
    params.set('sheet', options.tab);
  }

  return `${base}?${params.toString()}`;
}

/** URL de la page qui liste les onglets d'un classeur partage par lien. */
export function buildHtmlViewUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`;
}

/**
 * Extrait les identifiants d'onglets d'une page `htmlview`.
 *
 * Les noms d'onglets n'y figurent pas, seulement leurs gid : c'est pourquoi la
 * reconnaissance d'un onglet passe ensuite par ses colonnes.
 */
export function extractGidsFromHtml(html: string): string[] {
  const found = new Set<string>();

  for (const match of html.matchAll(/gid=(\d+)/g)) {
    found.add(match[1]);
  }

  return Array.from(found);
}

/**
 * Un onglet peut etre designe de trois facons : par son nom, par son gid, ou
 * en collant l'URL de l'onglet (qui contient `#gid=`).
 *
 * Le gid est la designation fiable : sur un classeur simplement partage par
 * lien, Google ignore le parametre `sheet=` et renvoie toujours l'onglet par
 * defaut.
 */
export function parseTabRef(value: string): { gid: string } | { tab: string } {
  const trimmed = (value || '').trim();

  const fromUrl = extractGid(trimmed);
  if (fromUrl) return { gid: fromUrl };

  if (/^\d+$/.test(trimmed)) return { gid: trimmed };

  return { tab: trimmed };
}

/**
 * Proportion des colonnes attendues retrouvees parmi celles lues.
 *
 * Sert a reconnaitre un onglet a son contenu quand son nom n'est pas
 * exploitable. Renvoie une valeur entre 0 et 1.
 */
export function scoreHeaders(actual: string[], expected: string[]): number {
  if (expected.length === 0) return 0;

  const present = new Set(actual.map(normalizeHeader).filter(Boolean));
  const matched = expected.filter(header => present.has(normalizeHeader(header))).length;

  return matched / expected.length;
}

/* ------------------------------------------------------------------ *
 * 2. Analyse CSV (RFC 4180 : guillemets, virgules et sauts de ligne)
 * ------------------------------------------------------------------ */

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // Retire un eventuel BOM
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }

    if (char === '\r') {
      i += 1;
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // Derniere ligne si le fichier ne finit pas par un saut de ligne
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Ignore les lignes totalement vides
  return rows.filter(cells => cells.some(cell => cell.trim() !== ''));
}

/** Retire les diacritiques (plage Unicode des marques combinantes U+0300 a U+036F). */
export function stripAccents(value: string): string {
  const COMBINING_START = 0x300;
  const COMBINING_END = 0x36f;

  return value
    .normalize('NFD')
    .split('')
    .filter(char => {
      const code = char.charCodeAt(0);
      return code < COMBINING_START || code > COMBINING_END;
    })
    .join('');
}

/** Normalise un en-tete de colonne : minuscules, sans accents, underscores. */
export function normalizeHeader(header: string): string {
  return stripAccents(header || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export interface SheetTable {
  headers: string[];
  rows: Record<string, string>[];
}

/** Transforme une matrice CSV en objets indexes par en-tete normalise. */
export function toTable(matrix: string[][]): SheetTable {
  if (matrix.length === 0) return { headers: [], rows: [] };

  const headers = matrix[0].map(normalizeHeader);

  const rows = matrix.slice(1).map(cells => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });

  return { headers, rows };
}

/** Lit la premiere colonne renseignee parmi une liste d'alias. */
export function pick(row: Record<string, string>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value !== undefined && value !== '') return value;
  }
  return '';
}

/* ------------------------------------------------------------------ *
 * 3. Mapping des comptes utilisateurs et des roles
 * ------------------------------------------------------------------ */

const ROLE_ALIASES: Record<string, ParticipantRole> = {
  super_admin: 'super-admin',
  superadmin: 'super-admin',
  admin: 'super-admin',
  administrateur: 'super-admin',
  organizer: 'organizer',
  organisateur: 'organizer',
  organisatrice: 'organizer',
  staff: 'organizer',
  comite: 'organizer',
  speaker: 'speaker',
  conferencier: 'speaker',
  conferenciere: 'speaker',
  intervenant: 'speaker',
  intervenante: 'speaker',
  formateur: 'speaker',
  volunteer: 'volunteer',
  volontaire: 'volunteer',
  benevole: 'volunteer',
  sponsor: 'sponsor',
  partenaire: 'sponsor',
  exposant: 'sponsor',
  attendee: 'attendee',
  participant: 'attendee',
  participante: 'attendee',
  auditeur: 'attendee',
  invite: 'attendee',
};

/** Convertit un libelle de role (FR ou EN, avec ou sans accents) en role interne. */
export function parseRole(raw: string, fallback: ParticipantRole = 'attendee'): ParticipantRole {
  const key = normalizeHeader(raw);
  return ROLE_ALIASES[key] || fallback;
}

const STATUS_ALIASES: Record<string, AccountStatus> = {
  active: 'active',
  actif: 'active',
  valide: 'active',
  ok: 'active',
  oui: 'active',
  yes: 'active',
  true: 'active',
  confirme: 'active',
  pending: 'pending',
  attente: 'pending',
  en_attente: 'pending',
  suspended: 'suspended',
  suspendu: 'suspended',
  bloque: 'suspended',
  desactive: 'suspended',
  inactif: 'suspended',
  no: 'suspended',
  non: 'suspended',
  false: 'suspended',
};

export function parseStatus(raw: string, fallback: AccountStatus = 'active'): AccountStatus {
  if (!raw) return fallback;
  return STATUS_ALIASES[normalizeHeader(raw)] || fallback;
}

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Convertit une ligne de l'onglet `Utilisateurs` en compte applicatif.
 *
 * Les en-tetes sont tolerants : Email / Adresse email / Mail, Role / Fonction,
 * Mot de passe / Password / Code, etc. Le mot de passe ainsi lu est en clair :
 * il est destine a etre hache immediatement par le serveur.
 */
export function mapUserAccount(row: Record<string, string>): UserAccount | null {
  const email = normalizeEmail(
    pick(row, 'email', 'adresse email', 'mail', 'e-mail', 'courriel'),
  );
  if (!email || !email.includes('@')) return null;

  const name =
    pick(row, 'name', 'nom', 'nom complet', 'full name', 'prenom nom', 'participant') ||
    email.split('@')[0].replace(/[._-]+/g, ' ');

  return {
    email,
    name,
    role: parseRole(pick(row, 'role', 'profil', 'fonction', 'type', 'categorie')),
    status: parseStatus(pick(row, 'status', 'statut', 'etat', 'actif', 'validation')),
    password:
      pick(row, 'mot de passe', 'password', 'motdepasse', 'code', 'code acces', "code d'acces", 'pin') ||
      undefined,
    institution:
      pick(row, 'institution', 'organisation', 'structure', 'entreprise', 'universite', 'affiliation') ||
      undefined,
    position: pick(row, 'position', 'poste', 'titre', 'job') || undefined,
    ticketNumber: pick(row, 'ticket', 'ticket number', 'billet', 'numero billet', 'badge') || undefined,
    avatarUrl: pick(row, 'avatar', 'avatar url', 'photo', 'photo url', 'image') || undefined,
    assignedBy: pick(row, 'assigned by', 'attribue par', 'admin') || undefined,
    assignedAt: pick(row, 'assigned at', 'date attribution', 'horodateur', 'timestamp') || undefined,
  };
}

/** Convertit toute une table en liste de comptes (les lignes invalides sont ignorees). */
export function mapUserAccounts(table: SheetTable): UserAccount[] {
  const seen = new Set<string>();
  const accounts: UserAccount[] = [];

  for (const row of table.rows) {
    const account = mapUserAccount(row);
    if (!account || seen.has(account.email)) continue;
    seen.add(account.email);
    accounts.push(account);
  }

  return accounts;
}
