/**
 * Registre de la plateforme Tech Event.
 *
 * L'application servait un evenement ; elle en sert plusieurs, et il faut bien
 * que quelque chose sache lesquels existent et a qui ils sont.
 *
 * Ce registre vivait dans un classeur. Il vit maintenant dans la base, pour
 * deux raisons : les comptes et les commandes exigent des contraintes qu'une
 * feuille ne sait pas tenir, et rien ne doit etre lu dans un cache qui pourrait
 * differer d'un exemplaire du serveur a l'autre. Les fonctions interrogent donc
 * la base a chaque appel, sans memoire intermediaire.
 *
 * Les donnees de chaque evenement, elles, restent dans SON classeur : deux
 * evenements ne partagent aucune ligne, si bien que l'isolation tient a la
 * structure plutot qu'a la rigueur de chaque requete.
 */

import { randomUUID } from 'crypto';

import { baseConfiguree, DbError, query } from './db';

/* ------------------------------------------------------------------ *
 * Modele
 * ------------------------------------------------------------------ */

/**
 * Ce qu'une personne peut faire sur la plateforme elle-meme.
 *
 * A ne pas confondre avec son role DANS un evenement : quelqu'un peut etre
 * organisateur du sien et simple participant a un autre.
 */
export type PlatformRole = 'admin' | 'organizer' | 'member';

export type EventStatus = 'draft' | 'published' | 'archived';

export interface PlatformAccount {
  email: string;
  name: string;
  role: PlatformRole;
  /** Empreinte scrypt. Jamais renvoyee au navigateur. */
  passwordHash?: string;
  createdAt: string;
  suspended: boolean;
}

export interface EventRecord {
  /** Identifiant lisible, employe dans les URL : « forum-numerique-2027 ». */
  slug: string;
  name: string;
  edition: string;
  startDate: string;
  endDate: string;
  location: string;
  summary: string;
  ownerEmail: string;
  status: EventStatus;
  /** Classeur Google qui porte les donnees de CET evenement. */
  sheetUrl: string;
  appsScriptUrl: string;
  logoUrl: string;
  posterUrl: string;
  primaryColor: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ *
 * Identifiants d'URL
 * ------------------------------------------------------------------ */

/**
 * Fabrique un identifiant d'URL a partir d'un nom.
 *
 * Restreint aux lettres sans accent, aux chiffres et au tiret : cet
 * identifiant se retrouve dans des liens qu'on recopie a la main et qu'on
 * dicte au telephone.
 */
export function versSlug(valeur: string): string {
  return (valeur || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Un identifiant libre, derive du nom. */
export async function slugDisponible(nom: string, edition: string): Promise<string> {
  const base =
    versSlug([nom, edition].filter(Boolean).join(' ')) || `evenement-${randomUUID().slice(0, 6)}`;

  let slug = base;
  let n = 2;

  // La boucle s'arrete forcement : chaque tour essaie un suffixe different, et
  // l'unicite finit par etre garantie par la cle primaire de toute facon.
  while (true) {
    const pris = await query(`SELECT 1 FROM events WHERE slug = $1`, [slug]);
    if (!pris.rowCount) return slug;
    slug = `${base}-${n++}`;
  }
}

/* ------------------------------------------------------------------ *
 * Conversion
 * ------------------------------------------------------------------ */

/** Une date de PostgreSQL, ramenee a « AAAA-MM-JJ » ou a rien. */
function versJour(valeur: unknown): string {
  if (!valeur) return '';
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10);
  return String(valeur).slice(0, 10);
}

function versEvenement(l: Record<string, unknown>): EventRecord {
  return {
    slug: String(l.slug),
    name: String(l.name),
    edition: String(l.edition || ''),
    startDate: versJour(l.start_date),
    endDate: versJour(l.end_date),
    location: String(l.location || ''),
    summary: String(l.summary || ''),
    ownerEmail: String(l.owner_email),
    status: String(l.status) as EventStatus,
    sheetUrl: String(l.sheet_url || ''),
    appsScriptUrl: String(l.apps_script_url || ''),
    logoUrl: String(l.logo_url || ''),
    posterUrl: String(l.poster_url || ''),
    primaryColor: String(l.primary_color || '#047857'),
    createdAt: String(l.created_at),
    updatedAt: String(l.updated_at),
  };
}

function versCompte(l: Record<string, unknown>): PlatformAccount {
  return {
    email: String(l.email),
    name: String(l.name || ''),
    role: String(l.role) as PlatformRole,
    passwordHash: (l.password_hash as string) || undefined,
    createdAt: String(l.created_at),
    suspended: Boolean(l.suspended),
  };
}

/* ------------------------------------------------------------------ *
 * Consultation
 * ------------------------------------------------------------------ */

export function registreConfigure(): boolean {
  return baseConfiguree();
}

export async function tousLesEvenements(): Promise<EventRecord[]> {
  const r = await query(`SELECT * FROM events ORDER BY start_date DESC NULLS LAST, name`);
  return r.rows.map(versEvenement);
}

/** Les evenements visibles sans connexion. */
export async function evenementsPublics(): Promise<EventRecord[]> {
  const r = await query(
    `SELECT * FROM events WHERE status = 'published' ORDER BY start_date NULLS LAST, name`,
  );
  return r.rows.map(versEvenement);
}

/** Les evenements dont cette personne repond. */
export async function evenementsDe(email: string): Promise<EventRecord[]> {
  const r = await query(
    `SELECT * FROM events WHERE owner_email = lower($1) ORDER BY start_date DESC NULLS LAST, name`,
    [(email || '').toLowerCase()],
  );
  return r.rows.map(versEvenement);
}

export async function evenementParSlug(slug: string): Promise<EventRecord | undefined> {
  const r = await query(`SELECT * FROM events WHERE slug = $1`, [slug]);
  return r.rowCount ? versEvenement(r.rows[0]) : undefined;
}

export async function comptePlateforme(email: string): Promise<PlatformAccount | undefined> {
  const r = await query(`SELECT * FROM platform_accounts WHERE email = lower($1)`, [
    (email || '').toLowerCase(),
  ]);
  return r.rowCount ? versCompte(r.rows[0]) : undefined;
}

export async function tousLesComptes(): Promise<PlatformAccount[]> {
  const r = await query(`SELECT * FROM platform_accounts ORDER BY created_at`);
  return r.rows.map(versCompte);
}

/* ------------------------------------------------------------------ *
 * Ecriture
 * ------------------------------------------------------------------ */

/** Inscrit ou met a jour un evenement. */
export async function enregistrerEvenement(evenement: EventRecord): Promise<EventRecord> {
  const r = await query(
    `INSERT INTO events (slug, name, edition, start_date, end_date, location, summary,
                         owner_email, status, sheet_url, apps_script_url, logo_url, poster_url,
                         primary_color, updated_at)
     VALUES ($1,$2,$3,NULLIF($4,'')::date,NULLIF($5,'')::date,$6,$7,lower($8),$9,$10,$11,$12,$13,$14, now())
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       edition = EXCLUDED.edition,
       start_date = EXCLUDED.start_date,
       end_date = EXCLUDED.end_date,
       location = EXCLUDED.location,
       summary = EXCLUDED.summary,
       status = EXCLUDED.status,
       sheet_url = EXCLUDED.sheet_url,
       apps_script_url = EXCLUDED.apps_script_url,
       logo_url = EXCLUDED.logo_url,
       poster_url = EXCLUDED.poster_url,
       primary_color = EXCLUDED.primary_color,
       updated_at = now()
     RETURNING *`,
    [
      evenement.slug,
      evenement.name,
      evenement.edition,
      evenement.startDate,
      evenement.endDate,
      evenement.location,
      evenement.summary,
      evenement.ownerEmail,
      evenement.status,
      evenement.sheetUrl,
      evenement.appsScriptUrl,
      evenement.logoUrl,
      evenement.posterUrl,
      evenement.primaryColor,
    ],
  );

  // Le proprietaire n'est volontairement pas dans la clause de mise a jour :
  // sinon un organisateur pourrait s'attribuer l'evenement d'un autre en le
  // renvoyant avec son propre email.
  return versEvenement(r.rows[0]);
}

/** Inscrit ou met a jour un compte de plateforme. */
export async function enregistrerCompte(compte: PlatformAccount): Promise<PlatformAccount> {
  if (!compte.email.includes('@')) {
    throw new DbError('Adresse email invalide.', 400, 'bad_input');
  }

  const r = await query(
    `INSERT INTO platform_accounts (email, name, role, password_hash, suspended)
     VALUES (lower($1), $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       password_hash = COALESCE(EXCLUDED.password_hash, platform_accounts.password_hash),
       suspended = EXCLUDED.suspended
     RETURNING *`,
    [compte.email, compte.name, compte.role, compte.passwordHash || null, compte.suspended],
  );

  return versCompte(r.rows[0]);
}
