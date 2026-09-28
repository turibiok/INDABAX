/**
 * Appels a la plateforme Tech Event.
 *
 * Distincts de ceux d'un evenement : ici on parle du catalogue et des comptes
 * de la plateforme, la on parle du programme et des participants d'un
 * evenement precis. Les confondre reviendrait a laisser un organisateur
 * interroger les donnees d'un autre.
 */

export class ErreurPlateforme extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = 'ErreurPlateforme';
    this.status = status;
    this.reason = reason;
  }
}

async function appel<T>(chemin: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let reponse: Response;

  try {
    reponse = await fetch(chemin, {
      method: options.method || 'GET',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ErreurPlateforme("Le serveur est injoignable.", 0, 'network');
  }

  if (reponse.status === 204) return undefined as T;

  const donnees = await reponse.json().catch(() => ({}) as any);

  if (!reponse.ok) {
    throw new ErreurPlateforme(
      donnees?.error || `La requête a échoué (HTTP ${reponse.status}).`,
      reponse.status,
      donnees?.reason,
    );
  }

  return donnees as T;
}

/* ------------------------------------------------------------------ *
 * Evenements
 * ------------------------------------------------------------------ */

/** Un evenement tel que la vitrine le montre. */
export interface EvenementPublic {
  slug: string;
  name: string;
  edition: string;
  startDate: string;
  endDate: string;
  location: string;
  summary: string;
  logoUrl: string;
  posterUrl: string;
  primaryColor: string;
  status: 'draft' | 'published' | 'archived';
}

/** La vue de l'organisateur : elle porte en plus ce qui ne se montre pas. */
export interface EvenementGere extends EvenementPublic {
  ownerEmail: string;
  sheetUrl: string;
  appsScriptUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComptePlateforme {
  email: string;
  name: string;
  role: 'admin' | 'organizer' | 'member';
  suspended: boolean;
}

export function evenementsPublies(): Promise<{ configured: boolean; events: EvenementPublic[] }> {
  return appel('/api/platform/events');
}

export function evenementPublic(slug: string): Promise<{ event: EvenementPublic }> {
  return appel(`/api/platform/events/${encodeURIComponent(slug)}`);
}

export function mesEvenements(): Promise<{
  account: ComptePlateforme;
  events: EvenementGere[];
  canCreate: boolean;
}> {
  return appel('/api/platform/mine');
}

export type BrouillonEvenement = Partial<
  Pick<
    EvenementGere,
    | 'name'
    | 'edition'
    | 'startDate'
    | 'endDate'
    | 'location'
    | 'summary'
    | 'sheetUrl'
    | 'appsScriptUrl'
    | 'logoUrl'
    | 'posterUrl'
    | 'primaryColor'
    | 'status'
  >
>;

export function creerEvenement(
  brouillon: BrouillonEvenement,
): Promise<{ event: EvenementGere; message: string }> {
  return appel('/api/platform/events', { method: 'POST', body: brouillon });
}

export function modifierEvenement(
  slug: string,
  brouillon: BrouillonEvenement,
): Promise<{ event: EvenementGere; message: string }> {
  return appel(`/api/platform/events/${encodeURIComponent(slug)}`, { method: 'PUT', body: brouillon });
}

/* ------------------------------------------------------------------ *
 * Comptes
 * ------------------------------------------------------------------ */

export function inscrireOrganisateur(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ ok: boolean; message: string }> {
  return appel('/api/platform/register', { method: 'POST', body: input });
}

/* ------------------------------------------------------------------ *
 * Billetterie
 * ------------------------------------------------------------------ */

export interface BilletPropose {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  remaining: number | null;
  soldOut: boolean;
}

export interface BilletGere extends BilletPropose {
  quantityTotal: number | null;
  quantitySold: number;
  salesOpen: boolean;
}

export function billetsProposes(slug: string): Promise<{ tickets: BilletPropose[] }> {
  return appel(`/api/billetterie/${encodeURIComponent(slug)}/tickets`);
}

export function billetsGeres(slug: string): Promise<{ tickets: BilletGere[] }> {
  return appel(`/api/billetterie/${encodeURIComponent(slug)}/tickets/manage`);
}

export function creerBillet(
  slug: string,
  billet: { name: string; description?: string; priceMinor?: number; quantityTotal?: number | null },
): Promise<{ ticket: BilletGere; message: string }> {
  return appel(`/api/billetterie/${encodeURIComponent(slug)}/tickets`, { method: 'POST', body: billet });
}

export function commander(
  slug: string,
  commande: {
    email: string;
    name?: string;
    phone?: string;
    lines: { ticketTypeId: string; quantity: number }[];
  },
): Promise<{
  order: { id: string; status: string; totalMinor: number; currency: string };
  tickets: { code: string; holderName: string }[];
  message: string;
}> {
  return appel(`/api/billetterie/${encodeURIComponent(slug)}/orders`, {
    method: 'POST',
    body: commande,
  });
}

/* ------------------------------------------------------------------ *
 * Mise en forme
 * ------------------------------------------------------------------ */

/**
 * Affiche un prix.
 *
 * Les montants sont stockes dans la plus petite unite de la devise. Le franc
 * CFA n'a pas de subdivision, l'euro en a cent : diviser aveuglement par cent
 * afficherait « 50 F » pour cinq mille.
 */
const SANS_SUBDIVISION = new Set(['XOF', 'XAF', 'JPY', 'KRW', 'CLP', 'ISK', 'VND']);

export function prix(montantMineur: number, devise: string): string {
  if (montantMineur === 0) return 'Gratuit';

  const code = (devise || 'XOF').toUpperCase();
  const entier = SANS_SUBDIVISION.has(code) ? montantMineur : montantMineur / 100;

  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: SANS_SUBDIVISION.has(code) ? 0 : 2,
    }).format(entier);
  } catch {
    // Une devise inconnue d'Intl ne doit pas faire disparaitre le prix.
    return `${entier.toLocaleString('fr-FR')} ${code}`;
  }
}
