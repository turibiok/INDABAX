/**
 * Mise en place de la plateforme au demarrage.
 *
 * Tout ce qui suit doit pouvoir se rejouer sans dommage : le serveur redemarre
 * a chaque deploiement, et sur Render le disque repart vide. Rien ici ne
 * suppose donc un etat anterieur, et rien n'ecrase ce qui existe deja.
 *
 * L'ordre compte :
 *
 *   1. les tables, sans quoi rien d'autre ne peut s'ecrire ;
 *   2. le compte d'administration, faute de quoi personne ne pourrait entrer ;
 *   3. l'evenement decrit par l'environnement, pour qu'une installation
 *      existante se retrouve inscrite au registre sans intervention.
 */

import { baseConfiguree, DbError, preparerBase, query } from './db';
import { hashPassword } from './passwords';
import { versSlug } from './platform';

export interface ResultatAmorcage {
  /** Vrai quand la base est joignable et ses tables en place. */
  pret: boolean;
  tablesCreees: boolean;
  adminCree?: string;
  evenementInscrit?: string;
  messages: string[];
}

/**
 * Cree le compte d'administration decrit par l'environnement.
 *
 * Il n'est cree que s'il n'existe pas : son mot de passe ne sert donc qu'une
 * fois, a l'installation. Le changer dans l'environnement ensuite n'a aucun
 * effet — c'est voulu, un amorcage n'etant pas une reinitialisation.
 */
async function amorcerAdmin(messages: string[]): Promise<string | undefined> {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
  const motDePasse = process.env.PLATFORM_ADMIN_PASSWORD || '';

  if (!email.includes('@') || !motDePasse) return undefined;

  const existe = await query(`SELECT 1 FROM platform_accounts WHERE email = $1`, [email]);
  if (existe.rowCount && existe.rowCount > 0) return undefined;

  if (motDePasse.length < 8) {
    messages.push(
      "PLATFORM_ADMIN_PASSWORD fait moins de 8 caractères : le compte d'administration n'a pas été créé.",
    );
    return undefined;
  }

  await query(
    `INSERT INTO platform_accounts (email, name, role, password_hash)
     VALUES ($1, $2, 'admin', $3)
     ON CONFLICT (email) DO NOTHING`,
    [
      email,
      (process.env.PLATFORM_ADMIN_NAME || email.split('@')[0]).trim(),
      await hashPassword(motDePasse),
    ],
  );

  return email;
}

/**
 * Inscrit au registre l'evenement que l'environnement decrit.
 *
 * Une installation existante tourne sur `SHEET_URL` sans rien savoir du
 * registre : sans cette reprise, son evenement serait absent de la plateforme
 * et l'organisateur croirait tout perdu. L'inscription est faite une fois, et
 * ne touche plus a rien ensuite.
 */
async function reprendreEvenementExistant(
  proprietaire: string | undefined,
  messages: string[],
): Promise<string | undefined> {
  const sheetUrl = (process.env.SHEET_URL || '').trim();
  if (!sheetUrl) return undefined;

  const nom = (process.env.EVENT_NAME || '').trim();
  const slugVoulu = versSlug((process.env.EVENT_SLUG || '').trim() || nom);

  // Sans nom d'evenement, on ne saurait pas quoi inscrire : mieux vaut ne rien
  // faire que creer un « Sans titre » dans la vitrine de la plateforme.
  if (!slugVoulu || !nom) return undefined;

  const deja = await query(`SELECT 1 FROM events WHERE slug = $1`, [slugVoulu]);
  if (deja.rowCount && deja.rowCount > 0) return undefined;

  /*
   * Un evenement doit avoir un proprietaire existant : la contrainte de cle
   * etrangere le garantit. Sans compte d'administration, on s'abstient plutot
   * que d'echouer bruyamment au demarrage.
   */
  const owner =
    proprietaire || (await query(`SELECT email FROM platform_accounts WHERE role = 'admin' LIMIT 1`)).rows[0]?.email;

  if (!owner) {
    messages.push(
      `L'événement « ${nom} » n'a pas été inscrit : aucun compte d'administration pour en répondre.`,
    );
    return undefined;
  }

  await query(
    `INSERT INTO events (slug, name, edition, start_date, end_date, location, owner_email, status, sheet_url, apps_script_url)
     VALUES ($1, $2, $3, NULLIF($4,'')::date, NULLIF($5,'')::date, $6, $7, 'published', $8, $9)
     ON CONFLICT (slug) DO NOTHING`,
    [
      slugVoulu,
      nom,
      (process.env.EVENT_EDITION || '').trim(),
      (process.env.EVENT_START_DATE || '').trim(),
      (process.env.EVENT_END_DATE || '').trim(),
      (process.env.EVENT_LOCATION || '').trim(),
      owner,
      sheetUrl,
      (process.env.APPS_SCRIPT_URL || '').trim(),
    ],
  );

  return slugVoulu;
}

/**
 * Prepare la plateforme.
 *
 * Ne leve jamais : une base injoignable doit laisser l'application demarrer en
 * mode evenement unique plutot que d'empecher tout le monde d'entrer. Ce qui a
 * echoue est dit, pas tu.
 */
export async function amorcerPlateforme(): Promise<ResultatAmorcage> {
  const messages: string[] = [];

  if (!baseConfiguree()) {
    return {
      pret: false,
      tablesCreees: false,
      messages: ["DATABASE_URL n'est pas renseignée : mode événement unique."],
    };
  }

  try {
    await preparerBase();
  } catch (erreur) {
    const detail = erreur instanceof DbError ? erreur.message : String((erreur as Error)?.message || erreur);
    return {
      pret: false,
      tablesCreees: false,
      messages: [`Base injoignable, mode événement unique : ${detail}`],
    };
  }

  let adminCree: string | undefined;
  let evenementInscrit: string | undefined;

  try {
    adminCree = await amorcerAdmin(messages);
    evenementInscrit = await reprendreEvenementExistant(adminCree, messages);
  } catch (erreur) {
    messages.push(
      `Amorçage partiel : ${String((erreur as Error)?.message || erreur)}`,
    );
  }

  return { pret: true, tablesCreees: true, adminCree, evenementInscrit, messages };
}

/** Compte les lignes de chaque table, pour un etat des lieux lisible. */
export async function etatBase(): Promise<Record<string, number>> {
  const tables = ['platform_accounts', 'events', 'ticket_types', 'orders', 'tickets'];
  const etat: Record<string, number> = {};

  for (const table of tables) {
    // Le nom vient d'une liste fermee ecrite ici : aucune valeur exterieure
    // n'entre dans cette requete.
    const r = await query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    etat[table] = Number(r.rows[0]?.n || 0);
  }

  return etat;
}
