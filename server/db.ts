/**
 * Acces a la base PostgreSQL.
 *
 * La base porte ce qu'un tableur ne sait pas tenir : les comptes, les
 * evenements et les billets. Une commande payee demande de decrementer un
 * stock sans que deux acheteurs simultanes passent tous les deux — c'est
 * exactement ce qu'une transaction garantit et qu'une feuille de calcul ne
 * garantira jamais.
 *
 * Sans `DATABASE_URL`, rien n'est tente : l'application retombe sur son
 * fonctionnement mono-evenement, adosse au classeur. Cela permet de deployer
 * ce code sans base, et de brancher la base ensuite.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { SCHEMA_SQL } from './schema';

let pool: Pool | null = null;
let pretParDefaut: Promise<void> | null = null;

export class DbError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status = 500, reason?: string) {
    super(message);
    this.name = 'DbError';
    this.status = status;
    this.reason = reason;
  }
}

export function baseConfiguree(): boolean {
  return Boolean((process.env.DATABASE_URL || '').trim());
}

/**
 * Nom d'hote d'une chaine de connexion, ou chaine vide si elle est illisible.
 *
 * On passe par l'analyseur d'URL plutot que par une expression reguliere sur
 * la chaine entiere : un mot de passe contenant « .neon.tech » ferait
 * autrement passer n'importe quelle base pour une base Neon.
 */
function hoteDe(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Reconnait un hebergeur aux particularites connues. */
export function typeDeBase(url: string): 'local' | 'neon' | 'autre' {
  const hote = hoteDe(url);

  if (hote === 'localhost' || hote === '127.0.0.1' || hote === '::1') return 'local';
  if (hote === 'neon.tech' || hote.endsWith('.neon.tech')) return 'neon';
  return 'autre';
}

/**
 * Ce qui cloche dans une chaine de connexion, avant meme d'essayer.
 *
 * La chaine est recopiee a la main depuis un tableau de bord : autant dire
 * precisement ce qui manque plutot que de laisser tomber un « connection
 * terminated unexpectedly » une minute plus tard.
 */
export function verifierUrl(url: string): string[] {
  const remarques: string[] = [];
  const brut = (url || '').trim();

  if (!brut) return ["DATABASE_URL est vide."];

  if (!/^postgres(ql)?:\/\//i.test(brut)) {
    remarques.push("L'adresse doit commencer par « postgres:// » ou « postgresql:// ».");
  }

  const type = typeDeBase(brut);

  if (type === 'neon') {
    if (!/sslmode=require/i.test(brut)) {
      remarques.push("Neon exige « ?sslmode=require » à la fin de l'adresse.");
    }

    /*
     * Neon propose deux points d'entree. Celui qui porte « -pooler » tient un
     * gestionnaire de connexions ; l'autre les ouvre une a une et s'epuise des
     * que plusieurs visiteurs arrivent ensemble. Comme on ouvre justement un
     * bassin, c'est le premier qu'il faut.
     */
    if (!/-pooler\./i.test(hoteDe(brut))) {
      remarques.push(
        'Préférez l’adresse « pooled » de Neon — celle dont l’hôte contient ' +
          '« -pooler ». L’autre ouvre une connexion par requête et s’épuise ' +
          'dès que plusieurs personnes arrivent en même temps.',
      );
    }
  }

  return remarques;
}

/**
 * Le bassin de connexions, cree au premier besoin.
 *
 * `ssl` est exige des que l'hote n'est pas local : Neon, Render et Supabase le
 * demandent, et `rejectUnauthorized: false` accepte leur certificat interne
 * sans quoi la connexion echoue pour une raison illisible.
 */
export function getPool(): Pool {
  if (pool) return pool;

  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) {
    throw new DbError(
      "Aucune base de données configurée : renseignez DATABASE_URL.",
      503,
      'no_database',
    );
  }

  const type = typeDeBase(url);

  for (const remarque of verifierUrl(url)) console.warn(`DATABASE_URL : ${remarque}`);

  pool = new Pool({
    connectionString: url,
    ssl: type === 'local' ? undefined : { rejectUnauthorized: false },
    /*
     * Un bassin modeste chez Neon : le point d'entree « pooler » multiplexe
     * deja les connexions de son cote, et en demander dix de plus ne sert qu'a
     * consommer le quota.
     */
    max: Number(process.env.DATABASE_POOL_MAX || (type === 'neon' ? 5 : 10)),
    idleTimeoutMillis: 30_000,
    /*
     * Neon endort une base inactive et la reveille a la premiere connexion, ce
     * qui prend quelques secondes. Dix suffiraient d'ordinaire ; trente evitent
     * qu'un premier visiteur apres une nuit de calme tombe sur une erreur.
     */
    connectionTimeoutMillis: Number(
      process.env.DATABASE_CONNECT_TIMEOUT_MS || (type === 'neon' ? 30_000 : 10_000),
    ),
  });

  // Une erreur sur une connexion au repos ne doit pas abattre le serveur : le
  // bassin la remplacera de lui-meme.
  pool.on('error', erreur => {
    console.warn(`Connexion PostgreSQL perdue : ${erreur.message}`);
  });

  return pool;
}

/** Remplace le bassin — les tests y injectent leur base en memoire. */
export function setPool(remplacant: Pool | null): void {
  pool = remplacant;
  pretParDefaut = null;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  texte: string,
  valeurs: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(texte, valeurs);
}

/**
 * Execute plusieurs instructions dans une seule transaction.
 *
 * Tout echec annule l'ensemble. C'est ce qui permet d'emettre des billets et
 * d'incrementer le stock vendu sans jamais laisser l'un sans l'autre.
 */
export async function transaction<T>(travail: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const resultat = await travail(client);
    await client.query('COMMIT');
    return resultat;
  } catch (erreur) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // La transaction est perdue de toute facon : l'erreur d'origine compte.
    }
    throw erreur;
  } finally {
    client.release();
  }
}

/** Le schema des tables, solidaire du code qui l'execute. */
export function lireSchema(): string {
  return SCHEMA_SQL;
}

/**
 * Cree les tables manquantes.
 *
 * Le schema est ecrit pour etre rejoue sans dommage : il n'y a donc pas de
 * numero de version a tenir, et un deploiement ne peut pas se retrouver a
 * moitie migre.
 */
export async function preparerBase(): Promise<void> {
  if (!pretParDefaut) {
    pretParDefaut = (async () => {
      await getPool().query(lireSchema());
    })();
  }

  return pretParDefaut;
}

/** Ferme le bassin, pour un arret propre ou entre deux tests. */
export async function fermerBase(): Promise<void> {
  const actuel = pool;
  pool = null;
  pretParDefaut = null;
  if (actuel) await actuel.end().catch(() => undefined);
}
