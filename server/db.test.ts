/**
 * Verifie la lecture d'une chaine de connexion.
 *
 * Cette chaine est recopiee a la main depuis un tableau de bord. Les erreurs
 * qu'on y fait ne se voient pas : une adresse sans « sslmode » ou sans
 * « -pooler » se connecte parfois, puis lache sous la charge. Autant les dire
 * avant d'essayer.
 */

import { typeDeBase, verifierUrl } from './db';

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

/** Vrai quand au moins une remarque parle du sujet donne. */
const parle = (remarques: string[], sujet: string) =>
  remarques.some(r => r.toLowerCase().includes(sujet.toLowerCase()));

console.log('\n--- reconnaissance de l hebergeur ---');

check('une base locale', typeDeBase('postgres://u:p@localhost:5432/db'), 'local');
check('une base locale par IP', typeDeBase('postgres://u:p@127.0.0.1:5432/db'), 'local');
check(
  'Neon',
  typeDeBase('postgres://u:p@ep-x-123-pooler.eu-central-1.aws.neon.tech/db?sslmode=require'),
  'neon',
);
check('un autre hébergeur', typeDeBase('postgres://u:p@dpg-abc.frankfurt-postgres.render.com/db'), 'autre');

{
  // « neon.tech » doit etre le NOM D'HOTE, pas n'importe quelle partie de
  // l'adresse : une base dont le mot de passe contient « .neon.tech » n'est
  // pas chez Neon, et la traiter comme telle lui imposerait des exigences
  // qui n'ont pas lieu d'etre.
  check(
    'un mot de passe trompeur ne suffit pas',
    typeDeBase('postgres://u:x.neon.tech@ailleurs.example.com/db'),
    'autre',
  );
  check(
    'un nom de base trompeur non plus',
    typeDeBase('postgres://u:p@ailleurs.example.com/ma.neon.tech'),
    'autre',
  );
  check(
    'une adresse illisible reste « autre »',
    typeDeBase('pas une url'),
    'autre',
  );
}

console.log('\n--- ce qui manque dans l adresse ---');

check('une adresse vide est signalée', verifierUrl('').length, 1);
check('une adresse vide dit quoi', parle(verifierUrl(''), 'vide'), true);

check(
  'un schéma invalide est signalé',
  parle(verifierUrl('https://ep-x-pooler.neon.tech/db?sslmode=require'), 'postgres'),
  true,
);

check(
  'postgresql:// est accepté',
  parle(verifierUrl('postgresql://u:p@ep-x-pooler.neon.tech/db?sslmode=require'), 'postgres://'),
  false,
);

console.log('\n--- particularités de Neon ---');

{
  const bonne = 'postgres://u:p@ep-cool-1-pooler.eu-central-1.aws.neon.tech/techevent?sslmode=require';
  check('une adresse Neon correcte ne soulève rien', verifierUrl(bonne), []);
}

{
  const sansSsl = 'postgres://u:p@ep-cool-1-pooler.eu-central-1.aws.neon.tech/techevent';
  check('sslmode manquant est signalé', parle(verifierUrl(sansSsl), 'sslmode'), true);
}

{
  // C'est l'erreur qui coute le plus cher : l'adresse « directe » fonctionne
  // en essai, puis s'epuise des que plusieurs personnes arrivent ensemble.
  const directe = 'postgres://u:p@ep-cool-1.eu-central-1.aws.neon.tech/techevent?sslmode=require';
  check('adresse non « pooled » signalée', parle(verifierUrl(directe), 'pooler'), true);
  check('et on explique pourquoi', parle(verifierUrl(directe), 'même temps'), true);
}

{
  const tout = 'postgres://u:p@ep-cool-1.eu-central-1.aws.neon.tech/techevent';
  check('les deux manques sont dits ensemble', verifierUrl(tout).length, 2);
}

console.log('\n--- les autres hébergeurs ---');

{
  // Rien n'est exige d'un hebergeur qu'on ne connait pas : mieux vaut se taire
  // que reclamer un « -pooler » qui n'existe pas chez lui.
  const render = 'postgres://u:p@dpg-abc-a.frankfurt-postgres.render.com/techevent';
  check('aucune exigence propre à Neon ailleurs', verifierUrl(render), []);

  const locale = 'postgres://u:p@localhost:5432/techevent';
  check('ni en local', verifierUrl(locale), []);
}

console.log(`\n=== ${reussis} reussis, ${echoues} echoues ===`);

if (echoues > 0) process.exit(1);
