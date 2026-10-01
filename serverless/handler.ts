/**
 * Point d'entree pour un hebergeur sans etat (Vercel).
 *
 * Il n'ouvre aucun port : la plateforme lui passe chaque requete, et
 * l'application Express la traite comme un gestionnaire ordinaire.
 *
 * La preparation — base, classeur, configuration — est faite une seule fois et
 * partagee entre les requetes d'un meme processus. Un processus neuf la refera,
 * d'ou l'exigence qu'elle soit rejouable sans dommage.
 *
 * L'entree s'appelle « app » et non « server » : un fichier `server.ts` voisin
 * du dossier `server/` est ambigu pour Node, qui resout alors vers le dossier
 * et echoue.
 *
 * Ce fichier n'est pas celui qui est deploye : la construction le regroupe,
 * avec tout ce qu'il importe, dans `api/index.js`. L'hebergeur compile sinon
 * chaque fichier separement, et nos imports sans extension — « ./db » plutot
 * que « ./db.js » — ne se resolvent pas en modules ES. Les regrouper supprime
 * la question, et c'est deja ce que fait la construction pour l'autre
 * hebergeur.
 */

import type { IncomingMessage, ServerResponse } from 'http';

import { applicationPrete } from '../app';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await applicationPrete();
  return (app as unknown as (a: IncomingMessage, b: ServerResponse) => void)(req, res);
}
