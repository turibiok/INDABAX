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

import { randomBytes, randomUUID } from 'crypto';

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
  /**
   * Un administrateur a regarde ce compte.
   *
   * L'inscription est ouverte, mais publier un evenement sous le nom de la
   * plateforme ne l'est pas : tant que ce drapeau est faux, le compte existe
   * et peut se connecter, sans pouvoir rien publier.
   */
  validated: boolean;
  validatedBy?: string;
  validatedAt?: string;
  /** Mot de passe provisoire : il faudra en choisir un autre a la connexion. */
  mustChangePassword: boolean;
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

/**
 * Un horodatage de PostgreSQL, ramene au format ISO 8601.
 *
 * Le pilote rend un `timestamptz` sous forme de `Date`. Le passer par `String`
 * produit la forme locale — « Thu Oct 01 2026 21:25:30 GMT+0100 (heure
 * d'Afrique de l'Ouest) » — que PostgreSQL refuse ensuite en ecriture. Une
 * valeur relue puis reecrite faisait donc echouer la requete, et seulement
 * celle-la : le defaut ne se voyait qu'a l'aller-retour.
 */
function versInstant(valeur: unknown): string {
  if (!valeur) return '';
  if (valeur instanceof Date) return valeur.toISOString();
  return String(valeur);
}

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
    createdAt: versInstant(l.created_at),
    updatedAt: versInstant(l.updated_at),
  };
}

function versCompte(l: Record<string, unknown>): PlatformAccount {
  return {
    email: String(l.email),
    name: String(l.name || ''),
    role: String(l.role) as PlatformRole,
    passwordHash: (l.password_hash as string) || undefined,
    createdAt: versInstant(l.created_at),
    suspended: Boolean(l.suspended),
    validated: Boolean(l.validated),
    validatedBy: (l.validated_by as string) || undefined,
    validatedAt: l.validated_at ? versInstant(l.validated_at) : undefined,
    mustChangePassword: Boolean(l.must_change_password),
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

/**
 * Un mot de passe provisoire, lisible a voix haute.
 *
 * Sans I, O, 0 ni 1, qui se confondent quand on le dicte au telephone — et
 * c'est bien ainsi qu'il circulera. Douze caracteres tires au hasard
 * cryptographique : assez pour qu'il ne se devine pas le temps qu'il serve.
 */
export function motDePasseProvisoire(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const octets = randomBytes(12);

  let mot = '';
  for (const octet of octets) mot += alphabet[octet % alphabet.length];

  return `${mot.slice(0, 4)}-${mot.slice(4, 8)}-${mot.slice(8)}`;
}

/**
 * Un compte complet a partir de ce qu'on en sait.
 *
 * Les valeurs par defaut sont les plus restreintes : un compte nait membre,
 * non valide, et sans mot de passe provisoire. Oublier un champ donne ainsi
 * moins de droits, jamais plus.
 */
export function composerCompte(partiel: Partial<PlatformAccount> & { email: string }): PlatformAccount {
  return {
    name: partiel.email.split('@')[0],
    role: 'member',
    createdAt: new Date().toISOString(),
    suspended: false,
    validated: false,
    mustChangePassword: false,
    ...partiel,
  };
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
    `INSERT INTO platform_accounts
       (email, name, role, password_hash, suspended, validated, validated_by, validated_at, must_change_password)
     VALUES (lower($1), $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       -- Une empreinte absente conserve celle en place : l'ecran qui change un
       -- nom n'a aucune raison de connaitre le mot de passe.
       password_hash = COALESCE(EXCLUDED.password_hash, platform_accounts.password_hash),
       suspended = EXCLUDED.suspended,
       validated = EXCLUDED.validated,
       validated_by = EXCLUDED.validated_by,
       validated_at = EXCLUDED.validated_at,
       must_change_password = EXCLUDED.must_change_password
     RETURNING *`,
    [
      compte.email,
      compte.name,
      compte.role,
      compte.passwordHash || null,
      compte.suspended,
      compte.validated,
      compte.validatedBy || null,
      compte.validatedAt || null,
      compte.mustChangePassword,
    ],
  );

  return versCompte(r.rows[0]);
}

/* ------------------------------------------------------------------ *
 * Chiffres
 * ------------------------------------------------------------------ */

export interface StatistiquesPlateforme {
  comptes: number;
  organisateurs: number;
  evenements: number;
  publies: number;
  commandes: number;
  commandesPayees: number;
  billets: number;
  billetsUtilises: number;
  /** Recettes encaissees, par devise et dans la plus petite unite. */
  recettes: { devise: string; montant: number }[];
}

/**
 * Chiffres de la plateforme.
 *
 * Les recettes ne comptent que les commandes reglees : inclure celles qui sont
 * en attente afficherait un montant qui n'a pas ete encaisse, et sur lequel
 * personne ne devrait compter.
 */
export async function statistiques(): Promise<StatistiquesPlateforme> {
  const un = async (sql: string) => Number((await query(sql)).rows[0]?.n || 0);

  const recettes = await query(
    `SELECT currency, SUM(total_minor)::bigint AS total
       FROM orders WHERE status = 'paid'
      GROUP BY currency ORDER BY currency`,
  );

  return {
    comptes: await un(`SELECT COUNT(*)::int AS n FROM platform_accounts`),
    organisateurs: await un(
      `SELECT COUNT(*)::int AS n FROM platform_accounts WHERE role IN ('admin','organizer')`,
    ),
    evenements: await un(`SELECT COUNT(*)::int AS n FROM events`),
    publies: await un(`SELECT COUNT(*)::int AS n FROM events WHERE status = 'published'`),
    commandes: await un(`SELECT COUNT(*)::int AS n FROM orders`),
    commandesPayees: await un(`SELECT COUNT(*)::int AS n FROM orders WHERE status = 'paid'`),
    billets: await un(`SELECT COUNT(*)::int AS n FROM tickets WHERE status <> 'void'`),
    billetsUtilises: await un(`SELECT COUNT(*)::int AS n FROM tickets WHERE status = 'used'`),
    recettes: recettes.rows.map(l => ({
      devise: String(l.currency),
      montant: Number(l.total || 0),
    })),
  };
}
