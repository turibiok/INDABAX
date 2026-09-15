import { Router } from 'express';

import {
  getEventConfig,
  reloadEventConfig,
  saveEventConfig,
  saveRoles,
} from '../eventConfig';
import { AuthedRequest, requireCapability } from '../sessions';
import { SheetError } from '../sheetsGateway';
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
    config: {
      identity: config.identity,
      terminology: config.terminology,
      branding: config.branding,
      roles: config.roles,
      fromSheet: config.fromSheet,
    },
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
        config: {
          identity: config.identity,
          terminology: config.terminology,
          branding: config.branding,
          roles: config.roles,
          fromSheet: config.fromSheet,
        },
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
        terminology: corps.terminology,
        branding: corps.branding,
      });

      res.json({
        config: {
          identity: config.identity,
          terminology: config.terminology,
          branding: config.branding,
          roles: config.roles,
          fromSheet: config.fromSheet,
        },
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
      config: {
        identity: config.identity,
        terminology: config.terminology,
        branding: config.branding,
        roles: config.roles,
        fromSheet: config.fromSheet,
      },
      warnings: avertissements,
      message: 'Rôles enregistrés dans le classeur.',
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});
