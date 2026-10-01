/**
 * Billetterie : types de billets, commandes et billets emis.
 *
 * Tout ce fichier tourne autour d'une seule difficulte : deux personnes qui
 * achetent le dernier billet au meme instant. Sur une feuille de calcul, les
 * deux passent et l'organisateur rembourse. Ici, la reservation du stock et
 * l'emission des billets tiennent dans une transaction, et le stock est
 * decremente par une ecriture conditionnelle — celle qui arrive seconde ne
 * modifie aucune ligne et repart avec un refus.
 */

import { randomUUID } from 'crypto';

import { PoolClient } from 'pg';

import { DbError, query, transaction } from './db';

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';
export type TicketStatus = 'valid' | 'used' | 'void';

export interface TicketType {
  id: string;
  eventSlug: string;
  name: string;
  description: string;
  /** Prix dans la plus petite unite de la devise. 0 = gratuit. */
  priceMinor: number;
  currency: string;
  /** null : aucune limite. */
  quantityTotal: number | null;
  quantitySold: number;
  salesOpen: boolean;
  /** Ce qu'il reste, ou null quand le stock est illimite. */
  remaining: number | null;
}

export interface Order {
  id: string;
  eventSlug: string;
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
  status: OrderStatus;
  totalMinor: number;
  currency: string;
  paymentRef?: string;
  paymentMethod?: string;
  /** Identifiant de la transaction chez le prestataire de paiement. */
  paymentProviderId?: string;
  createdAt: string;
  paidAt?: string;
}

export interface Ticket {
  id: string;
  orderId: string;
  eventSlug: string;
  ticketTypeId: string;
  code: string;
  holderName: string;
  holderEmail: string;
  status: TicketStatus;
  usedAt?: string;
}

/* ------------------------------------------------------------------ *
 * Types de billets
 * ------------------------------------------------------------------ */

function versTypeDeBillet(l: Record<string, unknown>): TicketType {
  const total = l.quantity_total === null ? null : Number(l.quantity_total);
  const vendus = Number(l.quantity_sold);

  return {
    id: String(l.id),
    eventSlug: String(l.event_slug),
    name: String(l.name),
    description: String(l.description || ''),
    priceMinor: Number(l.price_minor),
    currency: String(l.currency),
    quantityTotal: total,
    quantitySold: vendus,
    salesOpen: Boolean(l.sales_open),
    remaining: total === null ? null : Math.max(0, total - vendus),
  };
}

export async function typesDeBillets(eventSlug: string): Promise<TicketType[]> {
  const r = await query(
    `SELECT * FROM ticket_types WHERE event_slug = $1 ORDER BY price_minor, id`,
    [eventSlug],
  );
  return r.rows.map(versTypeDeBillet);
}

export async function creerTypeDeBillet(input: {
  eventSlug: string;
  name: string;
  description?: string;
  priceMinor?: number;
  currency?: string;
  quantityTotal?: number | null;
}): Promise<TicketType> {
  const nom = (input.name || '').trim();
  if (!nom) throw new DbError('Le billet doit avoir un nom.', 400, 'bad_input');

  const prix = Math.max(0, Math.round(input.priceMinor || 0));
  const total =
    input.quantityTotal === null || input.quantityTotal === undefined
      ? null
      : Math.max(0, Math.round(input.quantityTotal));

  const r = await query(
    `INSERT INTO ticket_types (event_slug, name, description, price_minor, currency, quantity_total)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.eventSlug, nom, (input.description || '').trim(), prix, input.currency || 'XOF', total],
  );

  return versTypeDeBillet(r.rows[0]);
}

/* ------------------------------------------------------------------ *
 * Codes de billet
 * ------------------------------------------------------------------ */

// Sans I, O, 0 ni 1 : ces caracteres se confondent quand on recopie un code a
// la main dans le champ de recherche du scanner.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function codeDeBillet(prefixe: string): string {
  let corps = '';
  for (let i = 0; i < 8; i++) {
    corps += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }

  const tete = (prefixe || 'TE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TE';
  return `${tete}-${corps.slice(0, 4)}-${corps.slice(4)}`;
}

/* ------------------------------------------------------------------ *
 * Commande
 * ------------------------------------------------------------------ */

export interface LigneDemandee {
  ticketTypeId: string;
  quantity: number;
  /** Noms des porteurs, quand ils sont connus a la commande. */
  holders?: { name?: string; email?: string }[];
}

export interface ResultatCommande {
  order: Order;
  tickets: Ticket[];
}

/**
 * Reserve le stock d'un type de billet.
 *
 * L'ecriture est conditionnelle : le `WHERE` refuse la mise a jour si le stock
 * ne suffit plus. Deux acheteurs simultanes executent donc la meme instruction,
 * et le second ne modifie aucune ligne — ce qui est detecte ici plutot que
 * decouvert a l'entree de l'evenement.
 */
async function reserver(
  client: PoolClient,
  ticketTypeId: string,
  eventSlug: string,
  quantite: number,
): Promise<{ priceMinor: number; currency: string; name: string }> {
  const r = await client.query(
    `UPDATE ticket_types
        SET quantity_sold = quantity_sold + $1::int
      WHERE id = $2::bigint
        AND event_slug = $3
        AND sales_open = TRUE
        AND (quantity_total IS NULL OR quantity_sold + $1::int <= quantity_total)
      RETURNING price_minor, currency, name`,
    [quantite, ticketTypeId, eventSlug],
  );

  if (r.rowCount === 0) {
    // On distingue « inexistant » de « epuise » pour que le message serve a
    // quelque chose, sans révéler autre chose que ce que l'acheteur voit déjà.
    const existe = await client.query(
      `SELECT name, sales_open, quantity_total, quantity_sold
         FROM ticket_types WHERE id = $1::bigint AND event_slug = $2`,
      [ticketTypeId, eventSlug],
    );

    if (existe.rowCount === 0) {
      throw new DbError('Ce type de billet n’existe pas.', 404, 'unknown_ticket_type');
    }

    const t = existe.rows[0];
    if (!t.sales_open) {
      throw new DbError(`Les ventes de « ${t.name} » sont fermées.`, 409, 'sales_closed');
    }

    const reste = Math.max(0, Number(t.quantity_total) - Number(t.quantity_sold));
    throw new DbError(
      reste === 0
        ? `« ${t.name} » est épuisé.`
        : `Il ne reste que ${reste} billet(s) « ${t.name} ».`,
      409,
      'sold_out',
    );
  }

  return {
    priceMinor: Number(r.rows[0].price_minor),
    currency: String(r.rows[0].currency),
    name: String(r.rows[0].name),
  };
}

/**
 * Passe une commande et emet ses billets.
 *
 * Une commande entierement gratuite est payee d'emblee : demander un paiement
 * de zero franc n'aurait pas de sens. Une commande payante reste « en
 * attente » jusqu'a confirmation du prestataire — mais son stock est deja
 * reserve, sans quoi le billet pourrait disparaitre pendant le paiement.
 */
export async function passerCommande(input: {
  eventSlug: string;
  buyerEmail: string;
  buyerName?: string;
  buyerPhone?: string;
  lines: LigneDemandee[];
  codePrefix?: string;
}): Promise<ResultatCommande> {
  const email = (input.buyerEmail || '').trim().toLowerCase();
  if (!email.includes('@')) {
    throw new DbError('Une adresse email valide est nécessaire.', 400, 'bad_input');
  }

  const lignes = (input.lines || []).filter(l => Math.round(l.quantity) > 0);
  if (lignes.length === 0) {
    throw new DbError('Aucun billet demandé.', 400, 'empty');
  }

  const demande = lignes.reduce((n, l) => n + Math.round(l.quantity), 0);
  if (demande > 20) {
    // Une limite franche vaut mieux qu'un formulaire qui accepte 10 000 billets
    // et immobilise tout le stock d'un evenement.
    throw new DbError('Vingt billets au maximum par commande.', 400, 'too_many');
  }

  return transaction(async client => {
    const orderId = randomUUID();
    const billets: Ticket[] = [];
    let total = 0;
    let devise = 'XOF';

    for (const ligne of lignes) {
      const quantite = Math.round(ligne.quantity);
      const reserve = await reserver(client, ligne.ticketTypeId, input.eventSlug, quantite);

      total += reserve.priceMinor * quantite;
      devise = reserve.currency;

      for (let i = 0; i < quantite; i++) {
        const porteur = (ligne.holders || [])[i] || {};
        billets.push({
          id: randomUUID(),
          orderId,
          eventSlug: input.eventSlug,
          ticketTypeId: ligne.ticketTypeId,
          code: codeDeBillet(input.codePrefix || ''),
          holderName: (porteur.name || input.buyerName || '').trim(),
          holderEmail: (porteur.email || email).trim().toLowerCase(),
          status: 'valid',
        });
      }
    }

    const gratuite = total === 0;

    const commande = await client.query(
      `INSERT INTO orders (id, event_slug, buyer_email, buyer_name, buyer_phone, status, total_minor, currency, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orderId,
        input.eventSlug,
        email,
        (input.buyerName || '').trim(),
        (input.buyerPhone || '').trim(),
        gratuite ? 'paid' : 'pending',
        total,
        devise,
        gratuite ? new Date().toISOString() : null,
      ],
    );

    for (const b of billets) {
      await client.query(
        `INSERT INTO tickets (id, order_id, event_slug, ticket_type_id, code, holder_name, holder_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [b.id, b.orderId, b.eventSlug, b.ticketTypeId, b.code, b.holderName, b.holderEmail],
      );
    }

    return { order: versCommande(commande.rows[0]), tickets: billets };
  });
}

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

function versCommande(l: Record<string, unknown>): Order {
  return {
    id: String(l.id),
    eventSlug: String(l.event_slug),
    buyerEmail: String(l.buyer_email),
    buyerName: String(l.buyer_name || ''),
    buyerPhone: String(l.buyer_phone || ''),
    status: String(l.status) as OrderStatus,
    totalMinor: Number(l.total_minor),
    currency: String(l.currency),
    paymentRef: (l.payment_ref as string) || undefined,
    paymentMethod: (l.payment_method as string) || undefined,
    paymentProviderId: (l.payment_provider_id as string) || undefined,
    createdAt: versInstant(l.created_at),
    paidAt: l.paid_at ? versInstant(l.paid_at) : undefined,
  };
}

/**
 * Annule une commande et rend son stock.
 *
 * Le stock ne revient qu'une fois : la condition sur le statut empeche qu'une
 * double annulation le gonfle au-dela de ce qui a ete vendu.
 */
export async function annulerCommande(orderId: string): Promise<Order> {
  return transaction(async client => {
    const r = await client.query(
      `UPDATE orders SET status = 'cancelled'
        WHERE id = $1 AND status IN ('pending', 'paid')
        RETURNING *`,
      [orderId],
    );

    if (r.rowCount === 0) {
      throw new DbError('Commande introuvable ou déjà annulée.', 404, 'not_found');
    }

    const compte = await client.query(
      `SELECT ticket_type_id, COUNT(*)::int AS n
         FROM tickets WHERE order_id = $1 GROUP BY ticket_type_id`,
      [orderId],
    );

    for (const ligne of compte.rows) {
      /*
       * La garde est dans le `WHERE`, et non dans un ecretage de la valeur.
       *
       * Rendre plus de billets qu'il n'en a ete vendu signalerait une
       * incoherence ailleurs : mieux vaut que la mise a jour ne s'applique pas
       * — le `CHECK (quantity_sold >= 0)` du schema restant le dernier filet —
       * plutot qu'un `GREATEST` qui ramenerait silencieusement a zero et
       * effacerait la trace du probleme.
       */
      await client.query(
        `UPDATE ticket_types
            SET quantity_sold = quantity_sold - $1::int
          WHERE id = $2::bigint AND quantity_sold >= $1::int`,
        [Number(ligne.n), ligne.ticket_type_id],
      );
    }

    await client.query(`UPDATE tickets SET status = 'void' WHERE order_id = $1`, [orderId]);

    return versCommande(r.rows[0]);
  });
}

/** Retient l'identifiant de transaction du prestataire pour une commande. */
export async function attacherPaiement(orderId: string, transactionId: string): Promise<void> {
  await query(`UPDATE orders SET payment_provider_id = $2 WHERE id = $1`, [orderId, transactionId]);
}

/** Retrouve une commande par l'identifiant que le prestataire lui connait. */
export async function commandeParTransaction(transactionId: string): Promise<Order | undefined> {
  const r = await query(`SELECT * FROM orders WHERE payment_provider_id = $1`, [transactionId]);
  return r.rowCount ? versCommande(r.rows[0]) : undefined;
}

/** Une commande par son identifiant. */
export async function commande(orderId: string): Promise<Order | undefined> {
  const r = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  return r.rowCount ? versCommande(r.rows[0]) : undefined;
}

/**
 * Les commandes d'un acheteur sur un evenement.
 *
 * Reservee a un appelant qui a deja prouve etre cet acheteur : la liste
 * contient des noms, des telephones et de quoi savoir qui vient. On ne la sert
 * jamais sur la seule foi d'une adresse — voir la route qui l'emploie.
 */
export async function commandesDeLAcheteur(
  eventSlug: string,
  email: string,
): Promise<Order[]> {
  const r = await query(
    `SELECT * FROM orders
      WHERE event_slug = $1 AND lower(buyer_email) = lower($2)
      ORDER BY created_at DESC`,
    [eventSlug, email],
  );

  return r.rows.map(versCommande);
}

/** Marque une commande comme payee. Appele apres confirmation du prestataire. */
export async function marquerPayee(
  orderId: string,
  paiement: { ref?: string; method?: string },
): Promise<Order> {
  const r = await query(
    `UPDATE orders
        SET status = 'paid', paid_at = now(), payment_ref = $2, payment_method = $3
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [orderId, paiement.ref || null, paiement.method || null],
  );

  if (r.rowCount === 0) {
    throw new DbError('Commande introuvable ou déjà réglée.', 404, 'not_found');
  }

  return versCommande(r.rows[0]);
}

/**
 * Valide un billet a l'entree.
 *
 * L'ecriture est conditionnelle sur le statut : un billet presente deux fois
 * ne modifie aucune ligne la seconde fois, ce qui est precisement le controle
 * attendu a une porte.
 */
export async function validerBillet(
  eventSlug: string,
  code: string,
): Promise<{ ok: boolean; ticket?: Ticket; raison?: string }> {
  const r = await query(
    `UPDATE tickets SET status = 'used', used_at = now()
      WHERE event_slug = $1 AND code = $2 AND status = 'valid'
      RETURNING *`,
    [eventSlug, (code || '').trim().toUpperCase()],
  );

  if (r.rowCount === 1) {
    return { ok: true, ticket: versBillet(r.rows[0]) };
  }

  const existant = await query(
    `SELECT * FROM tickets WHERE event_slug = $1 AND code = $2`,
    [eventSlug, (code || '').trim().toUpperCase()],
  );

  if (existant.rowCount === 0) return { ok: false, raison: 'Billet inconnu.' };

  const t = versBillet(existant.rows[0]);
  return {
    ok: false,
    ticket: t,
    raison: t.status === 'used' ? 'Billet déjà utilisé.' : 'Billet annulé.',
  };
}

function versBillet(l: Record<string, unknown>): Ticket {
  return {
    id: String(l.id),
    orderId: String(l.order_id),
    eventSlug: String(l.event_slug),
    ticketTypeId: String(l.ticket_type_id),
    code: String(l.code),
    holderName: String(l.holder_name || ''),
    holderEmail: String(l.holder_email || ''),
    status: String(l.status) as TicketStatus,
    usedAt: l.used_at ? versInstant(l.used_at) : undefined,
  };
}

/** Les billets d'une commande. */
export async function billetsDeCommande(orderId: string): Promise<Ticket[]> {
  const r = await query(`SELECT * FROM tickets WHERE order_id = $1 ORDER BY created_at`, [orderId]);
  return r.rows.map(versBillet);
}
