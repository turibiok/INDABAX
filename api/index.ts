/**
 * Point d'entree pour un hebergeur sans etat (Vercel).
 *
 * Il n'ouvre aucun port : la plateforme lui passe chaque requete, et
 * l'application Express la traite comme un gestionnaire ordinaire.
 *
 * La preparation — base, classeur, configuration — est faite une seule fois et
 * partagee entre les requetes d'un meme processus. Un processus neuf la refera,
 * d'ou l'exigence qu'elle soit rejouable sans dommage.
 */

import type { IncomingMessage, ServerResponse } from 'http';

import { applicationPrete } from '../server';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await applicationPrete();
  return (app as unknown as (a: IncomingMessage, b: ServerResponse) => void)(req, res);
}
