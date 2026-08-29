import crypto from 'crypto';

/**
 * Mots de passe des comptes.
 *
 * Le serveur ne conserve jamais un mot de passe en clair : il en stocke une
 * empreinte scrypt salée. Un mot de passe saisi par un organisateur dans le
 * classeur Google Sheet est haché dès sa première lecture, puis seule
 * l'empreinte est écrite dans `.data/server-state.json`.
 *
 * scrypt vient de la bibliothèque standard de Node : aucune dépendance
 * supplémentaire n'est nécessaire.
 */

const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELISM = 1; // p
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export const MIN_PASSWORD_LENGTH = 6;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELISM },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
}

/** Produit une empreinte autoportante : `scrypt$N$r$p$sel$empreinte`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt);

  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELISM,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/** Compare un mot de passe à une empreinte, en temps constant. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!password || !stored) return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelism = Number(parts[3]);
  if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelism)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }

  const derived = await new Promise<Buffer | null>(resolve => {
    crypto.scrypt(
      password.normalize('NFKC'),
      salt,
      expected.length,
      { N: cost, r: blockSize, p: parallelism },
      (error, key) => resolve(error ? null : key),
    );
  });

  if (!derived || derived.length !== expected.length) return false;

  return crypto.timingSafeEqual(derived, expected);
}

/**
 * Compare deux chaînes en temps constant, quelle que soit leur longueur.
 *
 * Utilisé pour le mot de passe encore en clair dans le classeur, avant que le
 * serveur ne l'ait remplacé par une empreinte.
 */
export function safeEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a.normalize('NFKC')).digest();
  const digestB = crypto.createHash('sha256').update(b.normalize('NFKC')).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

/** Refuse les mots de passe trop courts, sans autre contrainte de forme. */
export function validatePassword(password: string): string | null {
  if (typeof password !== 'string' || password.trim().length === 0) {
    return 'Le mot de passe est requis.';
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }

  if (password.length > 200) {
    return 'Le mot de passe est trop long (200 caractères maximum).';
  }

  return null;
}

/**
 * Génère un mot de passe lisible à distribuer aux participants.
 * Alphabet sans caractères ambigus (0/O, 1/l/I).
 */
export function generatePassword(length = 10): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);

  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += alphabet[bytes[i] % alphabet.length];
  }
  return password;
}
