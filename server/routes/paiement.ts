import { Router, raw } from 'express';

import { DbError } from '../db';
import {
  configurationFedaPay,
  ErreurSignature,
  etatPaiement,
  ouvrirPaiement,
  paiementConfigure,
  statutEstPaye,
  verifierSignature,
} from '../fedapay';
import { evenementParSlug } from '../platform';
import {
  attacherPaiement,
  commande,
  commandeParTransaction,
  marquerPayee,
} from '../tickets';

/**
 * Paiement en ligne par FedaPay.
 *
 * Une regle traverse ce fichier : **une commande n'est declaree payee que sur
 * la parole de FedaPay**, jamais sur celle du navigateur. Le navigateur revient
 * de la page de paiement avec une adresse que n'importe qui peut fabriquer ;
 * la notification, elle, porte une signature.
 *
 * Le retour du navigateur sert donc seulement a montrer un ecran. Ce qui
 * decide, c'est la notification — ou, a defaut, une verification que le
 * serveur va faire lui-meme aupres de FedaPay.
 */
export const paiementRouter = Router();

function repondreErreur(res: any, error: unknown) {
  if (error instanceof DbError) {
    return res.status(error.status).json({ error: error.message, reason: error.reason });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(500).json({ error: message });
}

/** Adresse publique du service, pour les retours de paiement. */
function adresseDuService(req: any): string {
  const declaree = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (declaree) return declaree;

  // Sans APP_URL, on reconstruit depuis la requete. Moins sur derriere un
  // mandataire, mais preferable a une adresse absente.
  const protocole = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  return `${protocole}://${req.headers.host}`;
}

/** Dit si le paiement en ligne est disponible, sans reveler aucune cle. */
paiementRouter.get('/etat', (_req, res) => {
  const config = configurationFedaPay();

  res.json({
    configured: paiementConfigure(),
    environment: config.environnement,
    // Sans secret de notification, FedaPay ne pourra pas confirmer les
    // paiements : autant le dire ici plutot que de le decouvrir sur une
    // commande restee « en attente » sans raison apparente.
    canConfirm: Boolean(config.cleWebhook),
  });
});

/**
 * Ouvre une page de paiement pour une commande deja passee.
 *
 * La commande existe donc deja, son stock est reserve, et son montant vient de
 * la base — non du navigateur. Laisser le client annoncer le montant
 * reviendrait a le laisser fixer son prix.
 */
paiementRouter.post('/:slug/orders/:id/pay', async (req, res) => {
  try {
    const evenement = await evenementParSlug(req.params.slug);
    if (!evenement || evenement.status !== 'published') {
      return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
    }

    const cible = await commande(req.params.id);
    if (!cible || cible.eventSlug !== evenement.slug) {
      return res.status(404).json({ error: 'Commande introuvable.', reason: 'not_found' });
    }

    if (cible.status === 'paid') {
      return res.status(409).json({ error: 'Cette commande est déjà réglée.', reason: 'already_paid' });
    }

    if (cible.status !== 'pending') {
      return res.status(409).json({ error: 'Cette commande a été annulée.', reason: 'cancelled' });
    }

    const paiement = await ouvrirPaiement({
      montant: cible.totalMinor,
      devise: cible.currency,
      description: `${evenement.name} ${evenement.edition}`.trim(),
      emailClient: cible.buyerEmail,
      nomClient: cible.buyerName,
      telephoneClient: cible.buyerPhone,
      retourUrl: `${adresseDuService(req)}/?evenement=${encodeURIComponent(evenement.slug)}&commande=${cible.id}`,
      referenceCommande: cible.id,
    });

    await attacherPaiement(cible.id, paiement.transactionId);

    res.json({ url: paiement.url, message: 'Page de paiement ouverte.' });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/**
 * Etat d'une commande, tel que le navigateur peut le demander au retour.
 *
 * Quand la commande est encore « en attente » mais qu'une transaction lui est
 * attachee, le serveur interroge FedaPay lui-meme. Cela couvre le cas ou la
 * notification tarde ou s'est perdue : l'acheteur n'a pas a rafraichir sa page
 * en esperant.
 */
paiementRouter.get('/:slug/orders/:id', async (req, res) => {
  try {
    const cible = await commande(req.params.id);
    if (!cible || cible.eventSlug !== req.params.slug) {
      return res.status(404).json({ error: 'Commande introuvable.', reason: 'not_found' });
    }

    let statut = cible.status;

    if (statut === 'pending' && cible.paymentProviderId && paiementConfigure()) {
      const etat = await etatPaiement(cible.paymentProviderId);

      if (etat.paye) {
        const miseAJour = await marquerPayee(cible.id, {
          ref: cible.paymentProviderId,
          method: 'fedapay',
        });
        statut = miseAJour.status;
      }
    }

    res.json({
      order: { id: cible.id, status: statut, totalMinor: cible.totalMinor, currency: cible.currency },
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/**
 * Notification de FedaPay.
 *
 * Le corps est lu brut, et non par l'analyseur JSON d'Express : la signature
 * porte sur le texte exact recu, et le re-serialiser en changerait les espaces
 * et l'ordre des cles — donc l'empreinte. Des notifications parfaitement
 * authentiques seraient alors refusees, par intermittence et sans explication.
 */
paiementRouter.post('/webhook', raw({ type: '*/*' }), async (req, res) => {
  const { cleWebhook } = configurationFedaPay();
  const corpsBrut = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
  const entete = String(req.headers['x-fedapay-signature'] || '');

  try {
    verifierSignature(corpsBrut, entete, cleWebhook);
  } catch (error) {
    /*
     * Une signature invalide n'est pas une erreur de service : c'est un refus.
     * On journalise, parce qu'une rafale de refus signale soit un secret mal
     * recopie, soit quelqu'un qui essaie.
     */
    console.warn(
      `Notification FedaPay refusée : ${error instanceof ErreurSignature ? error.message : String(error)}`,
    );
    return res.status(400).json({ error: 'Signature invalide.', reason: 'bad_signature' });
  }

  let charge: any;
  try {
    charge = JSON.parse(corpsBrut);
  } catch {
    return res.status(400).json({ error: 'Corps illisible.', reason: 'bad_body' });
  }

  const transaction = charge?.entity || charge?.data?.entity || charge?.data || {};
  const transactionId = transaction?.id ? String(transaction.id) : '';
  const statut = String(transaction?.status || '');

  if (!transactionId) {
    // Rien a faire de cette notification, mais elle est authentique : on
    // accuse reception, sinon FedaPay la renverra indefiniment.
    return res.json({ ok: true, ignored: 'sans identifiant de transaction' });
  }

  try {
    const cible = await commandeParTransaction(transactionId);

    if (!cible) {
      return res.json({ ok: true, ignored: 'aucune commande pour cette transaction' });
    }

    if (!statutEstPaye(statut)) {
      return res.json({ ok: true, ignored: `statut « ${statut} »` });
    }

    if (cible.status === 'paid') {
      // FedaPay renvoie ses notifications jusqu'a obtenir un accuse : une
      // commande deja reglee n'est pas une erreur.
      return res.json({ ok: true, ignored: 'commande déjà réglée' });
    }

    await marquerPayee(cible.id, { ref: transactionId, method: 'fedapay' });
    res.json({ ok: true });
  } catch (error) {
    repondreErreur(res, error);
  }
});
