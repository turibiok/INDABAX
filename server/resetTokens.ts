import crypto from 'crypto';

/**
 * Jetons de réinitialisation de mot de passe.
 *
 * Un jeton est une valeur aléatoire de 32 octets, à usage unique et de courte
 * durée. Seule son empreinte est conservée : une fuite du magasin ne permet
 * donc pas de forger un lien valide.
 *
 * Les jetons vivent en mémoire. Un redémarrage du serveur les invalide tous,
 * ce qui est sans gravité — la personne redemande un lien — mais explique
 * qu'un lien puisse expirer plus tôt que prévu sur un hébergement qui met le
 * service en veille.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000;

/** Au-delà, une nouvelle demande pour le même email est refusée. */
const REQUEST_COOLDOWN_MS = 60 * 1000;

interface ResetEntry {
  email: string;
  createdAt: number;
  expiresAt: number;
}

/** Indexé par empreinte du jeton, jamais par le jeton lui-même. */
const entries = new Map<string, ResetEntry>();

/** Dernière demande par email, pour ne pas inonder une boîte. */
const lastRequest = new Map<string, number>();

function fingerprint(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function purgeExpired(now = Date.now()): void {
  for (const [key, entry] of entries.entries()) {
    if (now > entry.expiresAt) entries.delete(key);
  }
}

/** Vrai si une demande a déjà été faite pour cet email il y a moins d'une minute. */
export function isThrottled(email: string): boolean {
  const previous = lastRequest.get(email);
  return previous !== undefined && Date.now() - previous < REQUEST_COOLDOWN_MS;
}

/**
 * Enregistre une demande sans émettre de jeton.
 *
 * Appelé pour *toute* demande, y compris celles portant sur un email inconnu :
 * sans cela, un refus pour cause de refroidissement ne surviendrait que sur
 * les emails enregistrés, ce qui permettrait de les énumérer.
 */
export function noteRequest(email: string): void {
  lastRequest.set(email, Date.now());
}

/**
 * Émet un jeton pour un email. Les jetons précédents du même email sont
 * révoqués : un seul lien reste valide à la fois.
 */
export function issueToken(email: string): { token: string; expiresAt: Date } {
  purgeExpired();
  revokeTokensFor(email);

  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();

  entries.set(fingerprint(token), { email, createdAt: now, expiresAt: now + TOKEN_TTL_MS });
  lastRequest.set(email, now);

  return { token, expiresAt: new Date(now + TOKEN_TTL_MS) };
}

/**
 * Consomme un jeton et renvoie l'email associé.
 *
 * La consommation est immédiate : un lien ne sert qu'une fois, même si le
 * changement de mot de passe échoue ensuite pour une autre raison.
 */
export function consumeToken(token: string): { email: string } | null {
  purgeExpired();

  const key = fingerprint(token || '');
  const entry = entries.get(key);
  if (!entry) return null;

  entries.delete(key);
  return { email: entry.email };
}

/** Vérifie un jeton sans le consommer, pour afficher le formulaire. */
export function peekToken(token: string): { email: string } | null {
  purgeExpired();

  const entry = entries.get(fingerprint(token || ''));
  return entry ? { email: entry.email } : null;
}

export function revokeTokensFor(email: string): number {
  let removed = 0;

  for (const [key, entry] of entries.entries()) {
    if (entry.email === email) {
      entries.delete(key);
      removed += 1;
    }
  }

  return removed;
}

/** Purge périodique, pour ne pas garder des jetons expirés en mémoire. */
export function startTokenSweeper(intervalMs = 10 * 60 * 1000) {
  const timer = setInterval(() => purgeExpired(), intervalMs);
  timer.unref?.();
  return timer;
}

export function tokenCount(): number {
  purgeExpired();
  return entries.size;
}
