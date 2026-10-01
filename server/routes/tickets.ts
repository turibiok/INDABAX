import { Router } from 'express';

import { DbError, baseConfiguree } from '../db';
import { comptePlateforme, evenementParSlug } from '../platform';
import { AuthedRequest, requireAuth } from '../sessions';
import {
  annulerCommande,
  billetsDeCommande,
  commande,
  commandesDeLAcheteur,
  creerTypeDeBillet,
  marquerPayee,
  passerCommande,
  typesDeBillets,
  validerBillet,
} from '../tickets';

/**
 * Billetterie : ce que le public peut demander, et ce que l'organisateur gere.
 *
 * Une distinction traverse tout ce fichier : les billets d'un evenement sont
 * publics — leur prix et ce qu'il en reste doivent se voir avant toute
 * connexion, sans quoi personne ne peut decider d'en prendre. Tout le reste
 * est reserve a qui repond de l'evenement.
 */
export const ticketsRouter = Router();

function repondreErreur(res: any, error: unknown) {
  if (error instanceof DbError) {
    return res.status(error.status).json({ error: error.message, reason: error.reason });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(500).json({ error: message });
}

/** Sans base, la billetterie n'existe pas : autant le dire clairement. */
function exigeBase(res: any): boolean {
  if (baseConfiguree()) return true;

  res.status(503).json({
    error: "La billetterie demande une base de données : DATABASE_URL n'est pas renseignée.",
    reason: 'no_database',
  });
  return false;
}

/**
 * Verifie qu'on repond bien de cet evenement.
 *
 * Rend « introuvable » plutot qu'« interdit » quand ce n'est pas le cas : la
 * difference dirait a un curieux quels evenements existent.
 */
async function evenementDeLOrganisateur(req: AuthedRequest, slug: string) {
  const evenement = await evenementParSlug(slug);
  if (!evenement) return null;

  const email = (req.session?.email || '').toLowerCase();
  const compte = await comptePlateforme(email);

  if (compte?.suspended) return null;
  if (compte?.role === 'admin') return evenement;
  return evenement.ownerEmail === email ? evenement : null;
}

/* ------------------------------------------------------------------ *
 * Ce que le public voit
 * ------------------------------------------------------------------ */

/**
 * Les billets proposes par un evenement.
 *
 * Lisible sans connexion, mais amputee de ce qui ne regarde que
 * l'organisateur : le nombre exact deja vendu renseignerait sur son chiffre
 * d'affaires. Seul « il en reste » est public.
 */
ticketsRouter.get('/:slug/tickets', async (req, res) => {
  if (!exigeBase(res)) return;

  const evenement = await evenementParSlug(req.params.slug);
  if (!evenement || evenement.status !== 'published') {
    return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
  }

  try {
    const types = await typesDeBillets(evenement.slug);

    res.json({
      tickets: types
        .filter(t => t.salesOpen)
        .map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          priceMinor: t.priceMinor,
          currency: t.currency,
          remaining: t.remaining,
          soldOut: t.remaining !== null && t.remaining === 0,
        })),
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/**
 * Inscription en ligne : on demande des billets, on les recoit.
 *
 * Ouverte sans connexion, a dessein — exiger un compte pour s'inscrire a un
 * evenement gratuit ecarterait la moitie des gens. L'email suffit a retrouver
 * ses billets.
 */
ticketsRouter.post('/:slug/orders', async (req, res) => {
  if (!exigeBase(res)) return;

  const evenement = await evenementParSlug(req.params.slug);
  if (!evenement || evenement.status !== 'published') {
    return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
  }

  const corps = req.body || {};

  try {
    const { order, tickets } = await passerCommande({
      eventSlug: evenement.slug,
      buyerEmail: String(corps.email || ''),
      buyerName: String(corps.name || ''),
      buyerPhone: String(corps.phone || ''),
      lines: Array.isArray(corps.lines) ? corps.lines : [],
      codePrefix: evenement.slug.slice(0, 6),
    });

    res.status(201).json({
      order: {
        id: order.id,
        status: order.status,
        totalMinor: order.totalMinor,
        currency: order.currency,
      },
      tickets: tickets.map(t => ({ code: t.code, holderName: t.holderName })),
      message:
        order.status === 'paid'
          ? 'Inscription enregistrée. Conservez vos codes.'
          : 'Commande enregistrée. Elle sera confirmée après paiement.',
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/* ------------------------------------------------------------------ *
 * Ce que l'organisateur gere
 * ------------------------------------------------------------------ */

/** Cree un type de billet. */
ticketsRouter.post('/:slug/tickets', requireAuth, async (req: AuthedRequest, res) => {
  if (!exigeBase(res)) return;

  const evenement = await evenementDeLOrganisateur(req, req.params.slug);
  if (!evenement) {
    return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
  }

  const corps = req.body || {};

  try {
    const type = await creerTypeDeBillet({
      eventSlug: evenement.slug,
      name: String(corps.name || ''),
      description: String(corps.description || ''),
      priceMinor: Number(corps.priceMinor || 0),
      currency: String(corps.currency || 'XOF'),
      quantityTotal:
        corps.quantityTotal === null || corps.quantityTotal === undefined || corps.quantityTotal === ''
          ? null
          : Number(corps.quantityTotal),
    });

    res.status(201).json({ ticket: type, message: `Billet « ${type.name} » créé.` });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/** Vue complete des billets, chiffres de vente compris. */
ticketsRouter.get('/:slug/tickets/manage', requireAuth, async (req: AuthedRequest, res) => {
  if (!exigeBase(res)) return;

  const evenement = await evenementDeLOrganisateur(req, req.params.slug);
  if (!evenement) {
    return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
  }

  try {
    res.json({ tickets: await typesDeBillets(evenement.slug) });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/** Valide un billet a l'entree. */
ticketsRouter.post('/:slug/check-in', requireAuth, async (req: AuthedRequest, res) => {
  if (!exigeBase(res)) return;

  const evenement = await evenementDeLOrganisateur(req, req.params.slug);
  if (!evenement) {
    return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
  }

  try {
    const resultat = await validerBillet(evenement.slug, String((req.body || {}).code || ''));

    // Un refus n'est pas une erreur du serveur : c'est une reponse, et celui
    // qui tient la porte a besoin de la lire, pas de la deviner.
    res.json({
      ok: resultat.ok,
      reason: resultat.raison,
      ticket: resultat.ticket
        ? { code: resultat.ticket.code, holderName: resultat.ticket.holderName, status: resultat.ticket.status }
        : undefined,
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/** Confirme le paiement d'une commande. */
/* ------------------------------------------------------------------ *
 * Espace participant
 * ------------------------------------------------------------------ */

/**
 * Retrouve ses commandes et ses billets.
 *
 * Ouvert a tous, sans compte : un participant qui a achete un billet n'a
 * aucune raison d'avoir un compte sur la plateforme.
 *
 * La reference de commande fait office de preuve. C'est un UUID, qu'on ne
 * devine pas, et il a ete remis a l'acheteur au moment de l'achat. L'adresse
 * est exigee en plus : une reference egaree — dans un historique de navigateur,
 * sur une capture d'ecran — ne suffit alors pas a lire la commande.
 *
 * Les deux reunis prouvent qu'on est bien l'acheteur, et la reponse donne
 * alors toutes ses commandes sur cet evenement. C'est deliberé : sans cela, il
 * faudrait une reference par commande, et quelqu'un qui a achete deux fois en
 * aurait perdu une.
 *
 * L'echec est volontairement muet sur sa cause. Dire « cette reference existe
 * mais l'adresse ne correspond pas » apprendrait a qui tatonne qu'il tient une
 * vraie reference.
 */
ticketsRouter.post('/:slug/mes-billets', async (req, res) => {
  if (!exigeBase(res)) return;

  const corps = req.body || {};
  const reference = String(corps.reference || '').trim();
  const email = String(corps.email || '').trim().toLowerCase();

  if (!reference || !email) {
    return res.status(400).json({
      error: 'Indiquez la référence de votre commande et votre adresse e-mail.',
      reason: 'missing_fields',
    });
  }

  const muet = {
    error:
      'Aucune commande ne correspond. Vérifiez la référence et l’adresse utilisée lors de l’achat.',
    reason: 'not_found',
  };

  try {
    const preuve = await commande(reference);

    /*
     * Les trois conditions comptent autant : la commande existe, elle porte
     * bien sur cet evenement, et elle a ete passee avec cette adresse.
     */
    if (
      !preuve ||
      preuve.eventSlug !== req.params.slug ||
      preuve.buyerEmail.toLowerCase() !== email
    ) {
      return res.status(404).json(muet);
    }

    const commandes = await commandesDeLAcheteur(req.params.slug, email);

    const avecBillets = await Promise.all(
      commandes.map(async order => ({
        order,
        /*
         * Les billets existent des la commande, reglee ou non : c'est
         * `passerCommande` qui les engendre, pour tenir le stock. Leur code est
         * donc visible avant paiement, et l'ecran doit dire clairement lesquels
         * sont valables — un code seul ne prouve rien.
         */
        tickets: await billetsDeCommande(order.id),
      })),
    );

    res.json({ orders: avecBillets });
  } catch (error) {
    repondreErreur(res, error);
  }
});

ticketsRouter.post('/:slug/orders/:id/paid', requireAuth, async (req: AuthedRequest, res) => {
  if (!exigeBase(res)) return;

  const evenement = await evenementDeLOrganisateur(req, req.params.slug);
  if (!evenement) {
    return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
  }

  const corps = req.body || {};

  try {
    const order = await marquerPayee(req.params.id, {
      ref: String(corps.ref || ''),
      method: String(corps.method || 'manuel'),
    });

    res.json({ order, tickets: await billetsDeCommande(order.id), message: 'Commande réglée.' });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/** Annule une commande et rend son stock. */
ticketsRouter.post('/:slug/orders/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
  if (!exigeBase(res)) return;

  const evenement = await evenementDeLOrganisateur(req, req.params.slug);
  if (!evenement) {
    return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
  }

  try {
    res.json({ order: await annulerCommande(req.params.id), message: 'Commande annulée.' });
  } catch (error) {
    repondreErreur(res, error);
  }
});
