/**
 * Paiement par FedaPay.
 *
 * Deux choses seulement sont demandees a ce module : ouvrir une page de
 * paiement pour une commande, et croire FedaPay quand il annonce qu'elle est
 * reglee. Tout le reste — le stock, les billets — est deja tenu par la base.
 *
 * Le point delicat est le second. Une notification de paiement arrive par une
 * requete que n'importe qui peut envoyer : sans verification de signature,
 * il suffirait de la deviner pour obtenir des billets sans payer. La
 * verification est donc la piece centrale de ce fichier, et elle est ecrite
 * d'apres le SDK officiel, non d'apres une supposition.
 */

import { createHmac, timingSafeEqual } from 'crypto';

import { DbError } from './db';

const BASE_BAC_A_SABLE = 'https://sandbox-api.fedapay.com';
const BASE_PRODUCTION = 'https://api.fedapay.com';
const VERSION_API = 'v1';

/** Statuts que FedaPay considere comme payes. */
const STATUTS_PAYES = new Set([
  'approved',
  'transferred',
  'refunded',
  'approved_partially_refunded',
  'transferred_partially_refunded',
]);

/** Fenetre de validite d'une notification, en secondes. */
const TOLERANCE_SECONDES = 300;

export interface ConfigurationFedaPay {
  cleSecrete: string;
  cleWebhook: string;
  /** « live » ou « sandbox ». Tout autre valeur vaut bac a sable. */
  environnement: string;
}

export function configurationFedaPay(): ConfigurationFedaPay {
  return {
    cleSecrete: (process.env.FEDAPAY_SECRET_KEY || '').trim(),
    cleWebhook: (process.env.FEDAPAY_WEBHOOK_SECRET || '').trim(),
    environnement: (process.env.FEDAPAY_ENVIRONMENT || 'sandbox').trim().toLowerCase(),
  };
}

export function paiementConfigure(): boolean {
  return configurationFedaPay().cleSecrete.length > 0;
}

function base(): string {
  const env = configurationFedaPay().environnement;
  return env === 'live' || env === 'production' ? BASE_PRODUCTION : BASE_BAC_A_SABLE;
}

async function appelFedaPay<T>(
  chemin: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { cleSecrete } = configurationFedaPay();

  if (!cleSecrete) {
    throw new DbError(
      "Le paiement en ligne n'est pas configuré : renseignez FEDAPAY_SECRET_KEY.",
      503,
      'no_payment',
    );
  }

  let reponse: Response;

  try {
    reponse = await fetch(`${base()}/${VERSION_API}${chemin}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${cleSecrete}`,
        'Content-Type': 'application/json',
        'X-Source': 'Tech Event',
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (erreur) {
    throw new DbError(
      `FedaPay est injoignable : ${(erreur as Error)?.message || erreur}`,
      502,
      'payment_unreachable',
    );
  }

  const texte = await reponse.text();

  let donnees: any = null;
  try {
    donnees = JSON.parse(texte);
  } catch {
    throw new DbError(
      `Réponse illisible de FedaPay : ${texte.slice(0, 200)}`,
      502,
      'payment_bad_response',
    );
  }

  if (!reponse.ok) {
    /*
     * Le message de FedaPay est repris tel quel quand il existe : il nomme
     * generalement ce qui manque, la ou « HTTP 422 » n'apprendrait rien a
     * l'organisateur qui lit le journal.
     */
    const detail =
      donnees?.message ||
      donnees?.error ||
      (donnees?.errors ? JSON.stringify(donnees.errors) : '') ||
      texte.slice(0, 200);

    throw new DbError(`FedaPay a refusé la demande : ${detail}`, reponse.status, 'payment_error');
  }

  return donnees as T;
}

/* ------------------------------------------------------------------ *
 * Ouvrir un paiement
 * ------------------------------------------------------------------ */

export interface PaiementOuvert {
  /** Identifiant FedaPay de la transaction, a conserver avec la commande. */
  transactionId: string;
  /** Page a ouvrir pour payer. */
  url: string;
}

/**
 * Cree une transaction FedaPay et rend l'adresse de sa page de paiement.
 *
 * Le montant part tel qu'il est stocke : le franc CFA n'a pas de subdivision,
 * et FedaPay attend des francs entiers. Une division par cent, ici, ferait
 * payer cinquante francs au lieu de cinq mille.
 */
export async function ouvrirPaiement(input: {
  montant: number;
  devise: string;
  description: string;
  emailClient: string;
  nomClient?: string;
  telephoneClient?: string;
  /** Adresse ou FedaPay renvoie le navigateur apres le paiement. */
  retourUrl: string;
  /** Notre identifiant de commande, pour recoller les deux mondes. */
  referenceCommande: string;
}): Promise<PaiementOuvert> {
  const [prenom, ...reste] = (input.nomClient || '').trim().split(/\s+/).filter(Boolean);

  const transaction = await appelFedaPay<{ 'v1/transaction': { id: number | string } }>(
    '/transactions',
    {
      method: 'POST',
      body: {
        description: input.description,
        amount: Math.round(input.montant),
        currency: { iso: (input.devise || 'XOF').toUpperCase() },
        callback_url: input.retourUrl,
        // Repris tel quel dans la notification : c'est ce qui permet de
        // retrouver la commande sans faire confiance a ce que le navigateur
        // renvoie.
        merchant_reference: input.referenceCommande,
        customer: {
          email: input.emailClient,
          firstname: prenom || input.emailClient.split('@')[0],
          lastname: reste.join(' ') || '-',
          ...(input.telephoneClient
            ? { phone_number: { number: input.telephoneClient, country: 'bj' } }
            : {}),
        },
      },
    },
  );

  const id = transaction['v1/transaction']?.id;
  if (!id) {
    throw new DbError("FedaPay n'a pas renvoyé d'identifiant de transaction.", 502, 'payment_error');
  }

  const jeton = await appelFedaPay<{ token: string; url: string }>(`/transactions/${id}/token`, {
    method: 'POST',
  });

  if (!jeton?.url) {
    throw new DbError("FedaPay n'a pas renvoyé de page de paiement.", 502, 'payment_error');
  }

  return { transactionId: String(id), url: jeton.url };
}

/** Etat d'une transaction, tel que FedaPay le connait. */
export async function etatPaiement(transactionId: string): Promise<{ statut: string; paye: boolean }> {
  const r = await appelFedaPay<{ 'v1/transaction': { status: string } }>(
    `/transactions/${encodeURIComponent(transactionId)}`,
  );

  const statut = r['v1/transaction']?.status || 'inconnu';
  return { statut, paye: STATUTS_PAYES.has(statut) };
}

/* ------------------------------------------------------------------ *
 * Verifier une notification
 * ------------------------------------------------------------------ */

/** Comparaison a duree constante, pour ne rien apprendre par le temps de reponse. */
function memeChaine(a: string, b: string): boolean {
  const ta = Buffer.from(a, 'utf8');
  const tb = Buffer.from(b, 'utf8');

  // `timingSafeEqual` exige deux longueurs egales : la difference de longueur
  // n'est pas un secret, elle peut donc etre testee avant.
  if (ta.length !== tb.length) return false;
  return timingSafeEqual(ta, tb);
}

/**
 * Lit l'en-tete « X-FEDAPAY-SIGNATURE ».
 *
 * Sa forme est « t=<horodatage>,s=<empreinte> », et il peut porter plusieurs
 * empreintes — le temps d'une rotation de secret, ou l'ancienne et la nouvelle
 * coexistent.
 */
export function lireEnteteSignature(entete: string): { horodatage: number; signatures: string[] } {
  const vide = { horodatage: -1, signatures: [] as string[] };
  if (typeof entete !== 'string') return vide;

  return entete.split(',').reduce((acc, morceau) => {
    const [cle, valeur] = morceau.split('=');

    if (cle?.trim() === 't') acc.horodatage = parseInt(valeur, 10);
    if (cle?.trim() === 's' && valeur) acc.signatures.push(valeur.trim());

    return acc;
  }, { ...vide, signatures: [] as string[] });
}

export class ErreurSignature extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurSignature';
  }
}

/**
 * Verifie qu'une notification vient bien de FedaPay.
 *
 * L'empreinte porte sur « horodatage.corps », le corps etant le texte recu
 * exactement — pas un objet re-serialise, dont l'ordre des cles et les espaces
 * differeraient et invalideraient la signature.
 *
 * L'horodatage borne la fenetre : une notification authentique interceptee ne
 * peut pas etre rejouee des jours plus tard pour obtenir de nouveaux billets.
 */
export function verifierSignature(
  corpsBrut: string,
  entete: string,
  secret: string,
  toleranceSecondes = TOLERANCE_SECONDES,
): void {
  if (!secret) {
    throw new ErreurSignature(
      "Aucun secret de notification : renseignez FEDAPAY_WEBHOOK_SECRET. " +
        'Sans lui, n’importe qui pourrait déclarer une commande payée.',
    );
  }

  const { horodatage, signatures } = lireEnteteSignature(entete);

  if (horodatage === -1 || Number.isNaN(horodatage)) {
    throw new ErreurSignature("L'en-tête de signature ne porte pas d'horodatage lisible.");
  }

  if (signatures.length === 0) {
    throw new ErreurSignature("L'en-tête de signature ne porte aucune empreinte.");
  }

  const ecart = Math.abs(Math.floor(Date.now() / 1000) - horodatage);
  if (ecart > toleranceSecondes) {
    throw new ErreurSignature(
      `Notification trop ancienne (${ecart} s) : elle est refusée pour empêcher un rejeu.`,
    );
  }

  const attendue = createHmac('sha256', secret)
    .update(`${horodatage}.${corpsBrut}`, 'utf8')
    .digest('hex');

  if (!signatures.some(s => memeChaine(s, attendue))) {
    throw new ErreurSignature(
      "Aucune empreinte ne correspond. Vérifiez FEDAPAY_WEBHOOK_SECRET : c'est le secret " +
        'de notification, différent de la clé secrète de l’API.',
    );
  }
}

/** Dit si un statut de transaction vaut « payé ». */
export function statutEstPaye(statut: string): boolean {
  return STATUTS_PAYES.has((statut || '').toLowerCase());
}
