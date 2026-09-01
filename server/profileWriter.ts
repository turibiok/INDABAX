import { getSheetsConfig } from './store';
import { SheetError, writeRows } from './sheetsGateway';

/**
 * Écriture de l'empreinte du mot de passe dans le classeur.
 *
 * Sans ce retour vers le classeur, un mot de passe choisi par une personne ne
 * vivrait que dans `.data/server-state.json`. Or l'hébergement retenu ne
 * garantit pas ce fichier d'un redémarrage à l'autre : tout le monde devrait
 * alors se réinscrire après chaque mise en veille du service. Le classeur est
 * la seule mémoire durable dont l'application dispose, donc c'est là que
 * l'empreinte doit se trouver.
 *
 * Ce qui part est l'empreinte scrypt, jamais le mot de passe : elle ne permet
 * pas de retrouver ce que la personne a saisi. Une colonne vidée signifie un
 * compte à réactiver.
 */

/** Colonne clé de l'onglet des profils. */
const KEY_COLUMN = 'Email';

/** Colonne où l'empreinte est conservée. */
const HASH_COLUMN = 'Empreinte';

export interface HashWriteResult {
  written: boolean;
  /** Renseigné quand l'écriture n'a pas pu aboutir, pour être signalé. */
  warning?: string;
}

/**
 * Inscrit — ou efface — l'empreinte d'un compte dans l'onglet des profils.
 *
 * L'échec n'est pas une erreur fatale : le mot de passe fonctionne déjà en
 * mémoire, seule sa survie au redémarrage est en jeu. La fonction le signale
 * donc au lieu de faire échouer l'inscription de la personne.
 */
export async function rememberHashInSheet(email: string, hash: string): Promise<HashWriteResult> {
  const config = getSheetsConfig();

  if (!config.isLinked) {
    return { written: false };
  }

  if (!config.writeWebhookUrl.trim()) {
    return {
      written: false,
      warning:
        "Aucun Apps Script n'est configuré : le mot de passe fonctionne, mais il sera à choisir de " +
        'nouveau si le serveur redémarre. Un organisateur peut y remédier dans les paramètres.',
    };
  }

  try {
    await writeRows(
      config.profilesTab,
      [{ [KEY_COLUMN]: email, [HASH_COLUMN]: hash }],
      { keyColumn: KEY_COLUMN },
    );
    return { written: true };
  } catch (error: any) {
    const detail = error instanceof SheetError ? error.message : String(error?.message || error);
    console.warn(`Empreinte non enregistrée dans le classeur pour ${email} : ${detail}`);

    return {
      written: false,
      warning:
        'Le mot de passe est enregistré, mais le classeur n’a pas pu être mis à jour : il sera à ' +
        'choisir de nouveau si le serveur redémarre.',
    };
  }
}

/** Efface l'empreinte : la personne devra choisir un nouveau mot de passe. */
export function forgetHashInSheet(email: string): Promise<HashWriteResult> {
  return rememberHashInSheet(email, '');
}
