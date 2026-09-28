/**
 * Verifie la mise en forme des prix.
 *
 * Les montants sont stockes dans la plus petite unite de la devise. Diviser
 * aveuglement par cent afficherait « 50 F » la ou l'organisateur a saisi cinq
 * mille francs — une erreur qui ne se verrait qu'au moment de l'encaissement.
 */

import { prix } from './plateforme';

let reussis = 0;
let echoues = 0;

function check(label: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    reussis++;
    console.log('  OK   ' + label);
  } else {
    echoues++;
    console.log('  ECHEC ' + label);
    console.log('        attendu : ' + JSON.stringify(attendu));
    console.log('        obtenu  : ' + JSON.stringify(obtenu));
  }
}

/** Compare en ignorant les espaces, dont Intl varie d'une version a l'autre. */
const sansEspaces = (s: string) => s.replace(/[\s\u00a0\u202f]/g, '');

console.log('\n--- prix ---');

check('zéro se dit « Gratuit »', prix(0, 'XOF'), 'Gratuit');
check('zéro aussi en euro', prix(0, 'EUR'), 'Gratuit');

check(
  'le franc CFA n’est pas divisé',
  sansEspaces(prix(5000, 'XOF')).includes('5000'),
  true,
);
check(
  "et l'euro l'est",
  sansEspaces(prix(5000, 'EUR')).includes('50,00'),
  true,
);

check('le yen n’est pas divisé', sansEspaces(prix(1200, 'JPY')).includes('1200'), true);

{
  // Une devise inconnue d'Intl ne doit pas faire disparaitre le prix : mieux
  // vaut un affichage approximatif qu'une case vide sur un bouton d'achat.
  const rendu = prix(2500, 'ZZZ');
  check('une devise inconnue affiche quand même un montant', /\d/.test(rendu), true);
  check('et son code', rendu.includes('ZZZ'), true);
}

check('une devise en minuscules est acceptée', sansEspaces(prix(3000, 'xof')).includes('3000'), true);

console.log(`\n=== ${reussis} reussis, ${echoues} echoues ===`);
if (echoues > 0) process.exit(1);
