/**
 * Ou vivent les sessions.
 *
 * Elles vivaient dans une table en memoire, ce qui suppose un serveur unique
 * et durable. Des que le service tourne en plusieurs copies — ou sans etat,
 * comme chez un hebergeur serverless — une requete peut atterrir sur une copie
 * qui n'a jamais vu la session : la personne se retrouve deconnectee au
 * hasard, sans rien pour l'expliquer.
 *
 * Avec une base, les sessions y vivent. Sans base, la memoire fait l'affaire :
 * c'est le cas d'une installation mono-evenement adossee a son classeur, qui
 * tourne sur un seul serveur et n'a rien a gagner a une table de plus.
 */

import { baseConfiguree, query } from './db';

export interface SessionEnregistree {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  source: string;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
}

/** Repli quand aucune base n'est configuree. */
const enMemoire = new Map<string, SessionEnregistree>();

export function sessionsEnBase(): boolean {
  return baseConfiguree();
}

function versSession(l: Record<string, unknown>): SessionEnregistree {
  const instant = (v: unknown) => (v ? new Date(String(v)).getTime() : 0);

  return {
    id: String(l.id),
    email: String(l.email),
    name: String(l.name || ''),
    role: String(l.role),
    status: String(l.status),
    source: String(l.source),
    createdAt: instant(l.created_at),
    expiresAt: instant(l.expires_at),
    lastSeenAt: instant(l.last_seen_at),
  };
}

export async function enregistrer(session: SessionEnregistree): Promise<void> {
  if (!sessionsEnBase()) {
    enMemoire.set(session.id, { ...session });
    return;
  }

  await query(
    `INSERT INTO sessions (id, email, name, role, status, source, created_at, expires_at, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6, to_timestamp($7/1000.0), to_timestamp($8/1000.0), to_timestamp($9/1000.0))
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       status = EXCLUDED.status,
       source = EXCLUDED.source,
       expires_at = EXCLUDED.expires_at,
       last_seen_at = EXCLUDED.last_seen_at`,
    [
      session.id,
      session.email,
      session.name,
      session.role,
      session.status,
      session.source,
      session.createdAt,
      session.expiresAt,
      session.lastSeenAt,
    ],
  );
}

/**
 * Lit une session, et note qu'elle vient de servir.
 *
 * Une session expiree ou laissee trop longtemps sans usage est supprimee
 * plutot que rendue : le delai d'inactivite protege un poste partage sur
 * lequel quelqu'un a oublie de se deconnecter.
 */
export async function lire(
  id: string,
  delaiInactiviteMs: number,
): Promise<SessionEnregistree | null> {
  const maintenant = Date.now();

  if (!sessionsEnBase()) {
    const session = enMemoire.get(id);
    if (!session) return null;

    if (maintenant > session.expiresAt || maintenant - session.lastSeenAt > delaiInactiviteMs) {
      enMemoire.delete(id);
      return null;
    }

    session.lastSeenAt = maintenant;
    return session;
  }

  /*
   * Lecture et mise a jour en une seule instruction : deux requetes
   * laisseraient une fenetre ou une session expirant entre les deux serait
   * acceptee. Le `WHERE` porte les deux conditions d'expiration, si bien
   * qu'une session hors delai ne remonte simplement pas.
   */
  const r = await query(
    `UPDATE sessions
        SET last_seen_at = now()
      WHERE id = $1
        AND expires_at > now()
        AND last_seen_at > now() - ($2::bigint * interval '1 millisecond')
      RETURNING *`,
    [id, delaiInactiviteMs],
  );

  if (r.rowCount === 0) {
    // Perimee ou inconnue : on efface au passage, faute de quoi la table
    // grossirait indefiniment de sessions mortes.
    await query(`DELETE FROM sessions WHERE id = $1`, [id]).catch(() => undefined);
    return null;
  }

  return versSession(r.rows[0]);
}

export async function supprimer(id: string): Promise<void> {
  if (!sessionsEnBase()) {
    enMemoire.delete(id);
    return;
  }

  await query(`DELETE FROM sessions WHERE id = $1`, [id]);
}

/** Modifie les sessions ouvertes d'une personne — un role vient de changer. */
export async function modifierPourEmail(
  email: string,
  patch: { role?: string; status?: string; name?: string; source?: string },
): Promise<number> {
  const cible = email.toLowerCase();

  if (!sessionsEnBase()) {
    let n = 0;
    for (const session of enMemoire.values()) {
      if (session.email.toLowerCase() !== cible) continue;
      Object.assign(session, patch);
      n++;
    }
    return n;
  }

  const r = await query(
    `UPDATE sessions
        SET role = COALESCE($2, role),
            status = COALESCE($3, status),
            name = COALESCE($4, name),
            source = COALESCE($5, source)
      WHERE lower(email) = $1`,
    [cible, patch.role ?? null, patch.status ?? null, patch.name ?? null, patch.source ?? null],
  );

  return r.rowCount || 0;
}

/** Revoque toutes les sessions d'une personne. */
export async function revoquerPourEmail(email: string): Promise<number> {
  const cible = email.toLowerCase();

  if (!sessionsEnBase()) {
    let n = 0;
    for (const [id, session] of enMemoire.entries()) {
      if (session.email.toLowerCase() !== cible) continue;
      enMemoire.delete(id);
      n++;
    }
    return n;
  }

  const r = await query(`DELETE FROM sessions WHERE lower(email) = $1`, [cible]);
  return r.rowCount || 0;
}

/** Une session precise, par son identifiant. */
export async function lireBrute(id: string): Promise<SessionEnregistree | null> {
  if (!sessionsEnBase()) return enMemoire.get(id) || null;

  const r = await query(`SELECT * FROM sessions WHERE id = $1`, [id]);
  return r.rowCount ? versSession(r.rows[0]) : null;
}

/** Efface les sessions perimees. */
export async function purger(delaiInactiviteMs: number): Promise<number> {
  const maintenant = Date.now();

  if (!sessionsEnBase()) {
    let n = 0;
    for (const [id, session] of enMemoire.entries()) {
      if (maintenant > session.expiresAt || maintenant - session.lastSeenAt > delaiInactiviteMs) {
        enMemoire.delete(id);
        n++;
      }
    }
    return n;
  }

  const r = await query(
    `DELETE FROM sessions
      WHERE expires_at <= now()
         OR last_seen_at <= now() - ($1::bigint * interval '1 millisecond')`,
    [delaiInactiviteMs],
  );

  return r.rowCount || 0;
}

export async function compter(): Promise<number> {
  if (!sessionsEnBase()) return enMemoire.size;

  const r = await query(`SELECT COUNT(*)::int AS n FROM sessions WHERE expires_at > now()`);
  return Number(r.rows[0]?.n || 0);
}
