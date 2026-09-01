/**
 * Réduction d'une photo avant son envoi.
 *
 * Une photo prise au téléphone pèse plusieurs mégaoctets ; une cellule Google
 * Sheets n'accepte qu'une cinquantaine de milliers de caractères. Sans cette
 * étape, choisir sa propre photo échouerait pour presque tout le monde.
 *
 * Le traitement se fait dans le navigateur : l'image n'est jamais envoyée en
 * taille réelle, ce qui économise aussi la connexion des participants. La
 * qualité est abaissée par paliers jusqu'à tenir sous la limite, plutôt que
 * fixée d'avance — une photo simple garde ainsi une bonne qualité, une photo
 * chargée passe quand même.
 */

/** Côté de l'image produite. Suffisant pour un avatar affiché à 64 pixels. */
const TARGET_SIZE = 256;

/** Marge sous la limite du serveur, qui est elle-même sous celle du classeur. */
const MAX_LENGTH = 40_000;

const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.45, 0.34];

export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

export class ImageError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("Ce fichier n'a pas pu être lu comme une image."));
    };

    image.src = url;
  });
}

/**
 * Recadre au centre, en carré, puis compresse.
 *
 * Le recadrage carré évite qu'un portrait en pied devienne une bande
 * illisible dans une pastille ronde.
 */
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError('Choisissez un fichier image (JPEG, PNG ou WebP).');
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageError('Cette image dépasse 12 Mo. Choisissez-en une plus légère.');
  }

  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);

  if (side === 0) {
    throw new ImageError("Cette image est vide.");
  }

  const canvas = document.createElement('canvas');
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new ImageError("Le navigateur n'a pas pu préparer l'image.");
  }

  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    TARGET_SIZE,
    TARGET_SIZE,
  );

  for (const quality of QUALITY_STEPS) {
    const encoded = canvas.toDataURL('image/jpeg', quality);
    if (encoded.length <= MAX_LENGTH) return encoded;
  }

  throw new ImageError(
    'Cette image reste trop lourde même réduite. Essayez une photo moins détaillée, ' +
      "ou collez l'adresse d'une image déjà en ligne.",
  );
}
