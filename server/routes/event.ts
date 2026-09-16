import { Router } from 'express';

import {
  getEventConfig,
  reloadEventConfig,
  saveEventConfig,
  saveRoles,
} from '../eventConfig';
import { AuthedRequest, requireCapability } from '../sessions';
import { mailerInfo, sendEmail, SheetError } from '../sheetsGateway';
import { EventRole } from '../../src/types';

/**
 * Configuration de l'evenement.
 *
 * La lecture est publique : l'ecran de connexion affiche le nom de
 * l'evenement, ses dates et son logo avant toute session, et la table des
 * roles sert a nommer correctement un role dans l'interface. Rien de tout cela
 * n'est un secret — a la difference du lien du classeur, qui reste reserve.
 *
 * L'ecriture demande un droit precis, et c'est le serveur qui tranche : la
 * table des roles qu'il retient est celle qu'il a relue lui-meme, jamais celle
 * que le navigateur affirme avoir.
 */
export const eventRouter = Router();

/** Mise en forme unique de la configuration renvoyee, pour les quatre routes. */
function enveloppe(config: ReturnType<typeof getEventConfig>) {
  return {
    identity: config.identity,
    settings: config.settings,
    collections: config.collections,
    terminology: config.terminology,
    branding: config.branding,
    roles: config.roles,
    fromSheet: config.fromSheet,
  };
}

function repondreErreur(res: any, error: unknown) {
  if (error instanceof SheetError) {
    return res.status(error.status).json({ error: error.message, reason: error.reason });
  }

  const message = error instanceof Error ? error.message : String(error);
  return res.status(500).json({ error: message });
}

/** Configuration complete, lisible sans session. */
eventRouter.get('/config', (_req, res) => {
  const config = getEventConfig();

  res.json({
    config: enveloppe(config),
  });
});

/** Relit le classeur, pour prendre en compte une modification faite a la main. */
eventRouter.post(
  '/config/reload',
  requireCapability('canManageContent'),
  async (_req: AuthedRequest, res) => {
    try {
      const { config, avertissements } = await reloadEventConfig();
      res.json({
        config: enveloppe(config),
        warnings: avertissements,
        message: config.fromSheet
          ? 'Configuration relue depuis le classeur.'
          : "Aucun onglet de configuration dans le classeur : les valeurs livrées s'appliquent.",
      });
    } catch (error) {
      repondreErreur(res, error);
    }
  },
);

/** Modifie l'identite, le vocabulaire ou l'apparence. */
eventRouter.put(
  '/config',
  requireCapability('canManageContent'),
  async (req: AuthedRequest, res) => {
    const corps = req.body || {};

    try {
      const config = await saveEventConfig({
        identity: corps.identity,
        settings: corps.settings,
        collections: corps.collections,
        terminology: corps.terminology,
        branding: corps.branding,
      });

      res.json({
        config: enveloppe(config),
        message: 'Configuration enregistrée dans le classeur.',
      });
    } catch (error) {
      repondreErreur(res, error);
    }
  },
);

/**
 * Remplace la table des roles.
 *
 * Reservee a qui gere deja les roles : c'est le meme pouvoir, exerce sur la
 * definition plutot que sur l'attribution.
 */
eventRouter.put('/roles', requireCapability('canManageRoles'), async (req: AuthedRequest, res) => {
  const roles = (req.body || {}).roles as EventRole[] | undefined;

  if (!Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'Aucun rôle transmis.', reason: 'empty' });
  }

  try {
    const { config, avertissements } = await saveRoles(roles);

    res.json({
      config: enveloppe(config),
      warnings: avertissements,
      message: 'Rôles enregistrés dans le classeur.',
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/**
 * Etat de la messagerie : depuis quelle adresse le service ecrit, lesquelles il
 * peut emprunter, et si celle qui est configuree convient.
 *
 * Reservee a qui gere le classeur : elle revele l'adresse du compte Google qui
 * execute le script.
 */
eventRouter.get(
  '/mailer',
  requireCapability('canManageIntegrations'),
  async (_req: AuthedRequest, res) => {
    const voulue = getEventConfig().identity.senderEmail.trim();

    try {
      const info = await mailerInfo();
      const utilisables = [info.owner, ...info.aliases].filter(Boolean);
      const convient =
        !voulue || utilisables.some(a => a.toLowerCase() === voulue.toLowerCase());

      res.json({
        configured: true,
        owner: info.owner,
        aliases: info.aliases,
        remainingQuota: info.remainingQuota,
        senderEmail: voulue,
        senderOk: convient,
        message: !voulue
          ? `Les emails partent de ${info.owner}.`
          : convient
            ? `Les emails partent bien de ${voulue}.`
            : `${voulue} n'est pas autorisée sur le compte ${info.owner}. ` +
              `Adresses utilisables : ${utilisables.join(', ')}.`,
      });
    } catch (error) {
      repondreErreur(res, error);
    }
  },
);

/**
 * Envoie un email d'essai a l'adresse demandee.
 *
 * Verifier autrement supposerait de declencher une reinitialisation de mot de
 * passe sur un vrai compte : mieux vaut un essai explicite.
 */
eventRouter.post(
  '/mailer/test',
  requireCapability('canManageIntegrations'),
  async (req: AuthedRequest, res) => {
    const destinataire = String((req.body || {}).to || '').trim();

    if (!destinataire || !destinataire.includes('@')) {
      return res.status(400).json({ error: 'Adresse de destination manquante.', reason: 'bad_input' });
    }

    const evenement = getEventConfig().identity;
    const nom = [evenement.eventName, evenement.edition].filter(Boolean).join(' ');

    try {
      await sendEmail({
        to: destinataire,
        from: evenement.senderEmail,
        fromName: evenement.senderName || nom,
        subject: `${nom} — essai d'envoi`,
        body:
          `Cet email confirme que ${nom} sait écrire à ses participants.

` +
          `Expéditeur configuré : ${evenement.senderEmail || '(compte du Apps Script)'}
` +
          `Demandé par : ${req.session?.email || 'inconnu'}

` +
          `Si vous recevez ce message, les liens de réinitialisation de mot de passe ` +
          `arriveront eux aussi.
`,
      });

      res.json({ ok: true, message: `Email d'essai envoyé à ${destinataire}.` });
    } catch (error) {
      repondreErreur(res, error);
    }
  },
);
