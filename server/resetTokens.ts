import crypto from 'crypto';
import { baseConfiguree, query } from './db';

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

/**
 * Indexé par empreinte du jeton, jamais par le jeton lui-même.
 *
 * Repli quand aucune base n'est configurée. Avec une base, les jetons y vivent :
 * un lien émis par une copie du serveur doit être reconnu par les autres, sinon
 * la réinitialisation échoue une fois sur deux sans que personne comprenne
 * pourquoi.
 */
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
export async function issueTokenPersistant(
  email: string,
): Promise<{ token: string; expiresAt: Date }> {
  const emis = issueToken(email);

  if (baseConfiguree()) {
    await query(
      `INSERT INTO reset_tokens (token_hash, email, expires_at)
       VALUES ($1, lower($2), to_timestamp($3/1000.0))
       ON CONFLICT (token_hash) DO NOTHING`,
      [fingerprint(emis.token), email, emis.expiresAt.getTime()],
    );
  }

  return emis;
}

/**
 * Consomme un jeton, quel que soit l'endroit ou il a ete emis.
 *
 * L'ecriture de `used_at` est conditionnelle : un jeton presente deux fois ne
 * modifie aucune ligne la seconde fois, ce qui est exactement le controle
 * attendu — un lien de reinitialisation ne doit servir qu'une fois.
 */
export async function consumeTokenPersistant(token: string): Promise<{ email: string } | null> {
  const local = consumeToken(token);
  if (local) {
    if (baseConfiguree()) {
      await query(`UPDATE reset_tokens SET used_at = now() WHERE token_hash = $1`, [
        fingerprint(token),
      ]).catch(() => undefined);
    }
    return local;
  }

  if (!baseConfiguree()) return null;

  const r = await query(
    `UPDATE reset_tokens SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING email`,
    [fingerprint(token)],
  );

  return r.rowCount ? { email: String(r.rows[0].email) } : null;
}

/** Lit un jeton sans le consommer, pour dire a qui il appartient. */
export async function peekTokenPersistant(token: string): Promise<{ email: string } | null> {
  const local = peekToken(token);
  if (local) return local;

  if (!baseConfiguree()) return null;

  const r = await query(
    `SELECT email FROM reset_tokens
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [fingerprint(token)],
  );

  return r.rowCount ? { email: String(r.rows[0].email) } : null;
}

/** Revoque les jetons d'une personne, en memoire et en base. */
export async function revokeTokensForPersistant(email: string): Promise<number> {
  const n = revokeTokensFor(email);

  if (baseConfiguree()) {
    const r = await query(
      `DELETE FROM reset_tokens WHERE lower(email) = lower($1) AND used_at IS NULL`,
      [email],
    );
    return n + (r.rowCount || 0);
  }

  return n;
}

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
