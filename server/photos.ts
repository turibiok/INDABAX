import { getSheetsConfig } from './store';
import { SheetError, writeRows } from './sheetsGateway';

/**
 * Photo de profil.
 *
 * Le classeur ne peut pas recevoir de fichier : une cellule Google Sheets
 * accepte du texte, et rien de plus. Deux formes sont donc admises, et elles
 * couvrent les deux façons dont une personne dispose d'une photo :
 *
 * - une image réduite et compressée par le navigateur, transmise en
 *   `data:image/...;base64,...`. C'est le cas courant : on choisit une photo
 *   sur son téléphone, l'application la ramène à 256 pixels de côté, ce qui
 *   la fait tenir dans une cellule ;
 * - l'adresse d'une image déjà en ligne, en HTTPS.
 *
 * La limite est celle du classeur, pas une préférence : au-delà d'environ
 * 50 000 caractères, Google Sheets tronque la cellule, et l'image devient
 * illisible sans que rien ne le signale. Mieux vaut refuser avant.
 */

/** Marge sous la limite réelle de 50 000 caractères d'une cellule. */
const MAX_LENGTH = 42_000;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Colonne clé de l'onglet des profils. */
const KEY_COLUMN = 'Email';
const PHOTO_COLUMN = 'Photo';

export interface PhotoCheck {
  value: string;
  /** Renseigné quand la photo est refusée. */
  error?: string;
  reason?: string;
}

/** Vérifie une photo avant de l'écrire. Une chaîne vide efface la photo. */
export function checkPhoto(raw: unknown): PhotoCheck {
  if (typeof raw !== 'string') {
    return { value: '', error: 'Photo attendue sous forme de texte.', reason: 'invalid' };
  }

  const value = raw.trim();
  if (!value) return { value: '' };

  if (value.length > MAX_LENGTH) {
    return {
      value: '',
      error:
        'Cette image est trop lourde pour une cellule du classeur. Choisissez-en une plus petite, ' +
        "ou collez l'adresse d'une image déjà en ligne.",
      reason: 'too_large',
    };
  }

  if (value.startsWith('data:')) {
    const match = value.match(/^data:([a-z/+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) {
      return {
        value: '',
        error: "Format d'image non reconnu.",
        reason: 'invalid',
      };
    }

    if (!ALLOWED_TYPES.includes(match[1].toLowerCase())) {
      return {
        value: '',
        error: 'Formats acceptés : JPEG, PNG ou WebP.',
        reason: 'bad_type',
      };
    }

    return { value };
  }

  // Une adresse en clair circulerait dans les pages de tous les participants :
  // HTTPS est exigé, comme pour tout le reste des liens de l'application.
  if (!/^https:\/\/[^\s"'<>]+$/i.test(value)) {
    return {
      value: '',
      error: "L'adresse d'une photo doit commencer par https://.",
      reason: 'bad_url',
    };
  }

  return { value };
}

/**
 * Écrit la photo dans l'onglet des profils.
 *
 * Comme pour l'empreinte du mot de passe, l'échec n'annule pas le changement :
 * il vaut pour la session en cours, et ce qui manque est sa survie au
 * redémarrage. La raison est renvoyée pour être dite à la personne.
 */
export async function savePhotoInSheet(
  email: string,
  photo: string,
): Promise<{ written: boolean; warning?: string }> {
  const config = getSheetsConfig();

  if (!config.isLinked) return { written: false };

  if (!config.writeWebhookUrl.trim()) {
    return {
      written: false,
      warning:
        "Aucun Apps Script n'est configuré : la photo s'affiche, mais elle sera à choisir de " +
        'nouveau si le serveur redémarre.',
    };
  }

  try {
    await writeRows(config.profilesTab, [{ [KEY_COLUMN]: email, [PHOTO_COLUMN]: photo }], {
      keyColumn: KEY_COLUMN,
    });
    return { written: true };
  } catch (error: any) {
    const detail = error instanceof SheetError ? error.message : String(error?.message || error);
    console.warn(`Photo non enregistrée dans le classeur pour ${email} : ${detail}`);

    return {
      written: false,
      warning: 'La photo s’affiche, mais le classeur n’a pas pu être mis à jour.',
    };
  }
}
