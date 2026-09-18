/**
 * Mise en place et etat de la base, en ligne de commande.
 *
 * Le serveur fait deja tout cela a son demarrage. Cet outil sert aux cas ou on
 * veut le faire sans demarrer le serveur : verifier qu'une base repond avant
 * de deployer, ou regarder ce qu'elle contient.
 *
 *   npm run db:setup     crée les tables manquantes, puis amorce
 *   npm run db:status    compte les lignes de chaque table
 */

import { amorcerPlateforme, etatBase } from '../bootstrap';
import { baseConfiguree, fermerBase } from '../db';

async function main() {
  const action = (process.argv[2] || 'status').trim();

  if (!baseConfiguree()) {
    console.log("DATABASE_URL n'est pas renseignée.");
    console.log('  Sur Render : la déclaration render.yaml la pose d’elle-même.');
    console.log('  En local   : DATABASE_URL=postgres://… npm run db:setup');
    process.exit(1);
  }

  if (action === 'setup') {
    const r = await amorcerPlateforme();

    console.log(r.pret ? 'Base prête.' : 'Base injoignable.');
    if (r.adminCree) console.log(`  compte d'administration créé : ${r.adminCree}`);
    if (r.evenementInscrit) console.log(`  événement inscrit : ${r.evenementInscrit}`);
    for (const m of r.messages) console.log(`  ${m}`);

    if (!r.pret) process.exit(1);
  }

  const etat = await etatBase();
  console.log('\nContenu :');
  for (const [table, n] of Object.entries(etat)) {
    console.log(`  ${table.padEnd(20)} ${n} ligne(s)`);
  }
}

main()
  .catch(erreur => {
    console.log('Échec : ' + String(erreur?.message || erreur));
    process.exitCode = 1;
  })
  .finally(() => fermerBase());
