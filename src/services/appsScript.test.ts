import { APPS_SCRIPT_SNIPPET } from './sheetsDb';

/**
 * Tests du script fourni aux organisateurs.
 *
 * Ce script est livré sous forme de chaîne de caractères : rien, dans
 * l'application, ne l'exécute jamais. Une faute de logique y passerait donc la
 * compilation et tous les autres tests, pour n'être découverte qu'au moment où
 * une écriture part dans un onglet créé par erreur — ce qui est exactement
 * arrivé sur un classeur dont les onglets portaient un préfixe.
 *
 * On extrait donc `normalize` et `findSheet` du texte livré et on les exécute
 * contre de faux onglets. Ce qui est testé est bien ce que reçoit l'utilisateur.
 */

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
    console.log(`  OK   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}\n       attendu : ${e}\n       obtenu  : ${a}`);
  }
}

/** Extrait une fonction nommée du script, accolades appariées. */
function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`fonction « ${name} » absente du script livré`);

  let depth = 0;
  let seen = false;

  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
      seen = true;
    } else if (char === '}') {
      depth -= 1;
      if (seen && depth === 0) return source.slice(start, index + 1);
    }
  }

  throw new Error(`accolades non appariées dans « ${name} »`);
}

const code = [
  extractFunction(APPS_SCRIPT_SNIPPET, 'normalize'),
  extractFunction(APPS_SCRIPT_SNIPPET, 'findSheet'),
  'return { normalize: normalize, findSheet: findSheet };',
].join('\n');

// eslint-disable-next-line no-new-func
const { normalize, findSheet } = new Function(code)() as {
  normalize: (name: string) => string;
  findSheet: (spreadsheet: unknown, wanted: string) => { getName(): string } | null;
};

/** Faux classeur : seul `getSheets` est utilisé par `findSheet`. */
const classeur = (...noms: string[]) => ({
  getSheets: () => noms.map(nom => ({ getName: () => nom })),
});

const nomTrouve = (sheet: { getName(): string } | null) => (sheet ? sheet.getName() : null);

console.log('\n--- normalize ---');
check('accents retires', normalize('Rôle'), 'role');
check('tiret retire', normalize('Check-ins'), 'checkins');
check('espaces retires', normalize('check ins'), 'checkins');
check('casse ignoree', normalize('FEEDBACKS'), 'feedbacks');
check('prefixe conserve', normalize('indabax-sessions'), 'indabaxsessions');

console.log('\n--- findSheet : nom exact, a la forme pres ---');
check(
  'nom identique',
  nomTrouve(findSheet(classeur('Sessions', 'Feedbacks'), 'Sessions')),
  'Sessions',
);
check(
  'tiret et casse',
  nomTrouve(findSheet(classeur('check ins'), 'Check-ins')),
  'check ins',
);
check(
  'accents',
  nomTrouve(findSheet(classeur('Émargements'), 'emargements')),
  'Émargements',
);
check('onglet absent', nomTrouve(findSheet(classeur('Autre'), 'Sessions')), null);

console.log('\n--- findSheet : nom prefixe ---');
/*
 * Le cas reel : un classeur dont les onglets s'appellent « indabax-sessions ».
 * Sans cette tolerance, le script creait un onglet « Sessions » a cote, et les
 * ecritures semblaient disparaitre.
 */
check(
  'prefixe reconnu',
  nomTrouve(findSheet(classeur('indabax-utilisateurs', 'indabax-sessions'), 'Sessions')),
  'indabax-sessions',
);
check(
  'prefixe avec espace',
  nomTrouve(findSheet(classeur('IndabaX Check-ins'), 'Check-ins')),
  'IndabaX Check-ins',
);

// Deux candidats : mieux vaut echouer que choisir au hasard. Le serveur
// signalera l'onglet introuvable, et le nom exact pourra etre renseigne.
check(
  'ambiguite refusee',
  nomTrouve(findSheet(classeur('indabax-sessions', 'archive-sessions'), 'Sessions')),
  null,
);

// Le nom exact doit toujours gagner, meme si un prefixe existe aussi.
check(
  'le nom exact devance le prefixe',
  nomTrouve(findSheet(classeur('indabax-sessions', 'Sessions'), 'Sessions')),
  'Sessions',
);

// Un prefixe ne doit pas se confondre avec un suffixe accidentel.
check(
  'correspondance en fin de nom seulement',
  nomTrouve(findSheet(classeur('sessions-archive'), 'Sessions')),
  null,
);

console.log(`\n=== ${passed} reussis, ${failed} echoues ===`);
if (failed > 0) process.exit(1);
