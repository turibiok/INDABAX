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

/**
 * `columnIndex` et `ensureColumns` vivent dans la fermeture de `doPost` : elles
 * lisent `headers`, `sheet` et `colonnesAjoutees`. On les extrait avec ces
 * variables fournies autour, pour les exercer telles qu'elles tourneront.
 */
function monterEnsureColumns(entetes: string[]) {
  const ecrites: Array<{ colonne: number; valeur: string }> = [];

  const contexte = [
    extractFunction(APPS_SCRIPT_SNIPPET, 'normalize'),
    'var headers = donnees.entetes;',
    'var colonnesAjoutees = [];',
    'var sheet = donnees.sheet;',
    extractFunction(APPS_SCRIPT_SNIPPET, 'columnIndex'),
    extractFunction(APPS_SCRIPT_SNIPPET, 'ensureColumns'),
    'return { ensureColumns: ensureColumns, headers: headers, ajoutees: colonnesAjoutees };',
  ].join('\n');

  const sheet = {
    getRange: (_ligne: number, colonne: number) => ({
      setValue: (valeur: string) => ecrites.push({ colonne, valeur }),
    }),
  };

  // eslint-disable-next-line no-new-func
  const monte = new Function('donnees', contexte)({ entetes, sheet }) as {
    ensureColumns: (row: Record<string, unknown>) => void;
    headers: string[];
    ajoutees: string[];
  };

  return { ...monte, ecrites };
}

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

/* ------------------------------------------------------------------ *
 * Une colonne absente doit etre creee, pas ignoree.
 *
 * Sans cela, une donnee destinee a une colonne qui n'existe pas encore
 * disparait en silence : l'application annonce « enregistre » et rien n'est
 * ecrit. C'est arrive avec la colonne « Site web ».
 * ------------------------------------------------------------------ */

console.log('\n--- ensureColumns ---');

{
  const m = monterEnsureColumns(['Email', 'Nom', 'Telephone']);
  m.ensureColumns({ Email: 'a@b.c', Nom: 'Ada', 'Site web': 'ada.dev' });

  check('la colonne manquante est ajoutee', m.ajoutees, ['Site web']);
  check('elle vient a la fin des en-tetes', m.headers, ['Email', 'Nom', 'Telephone', 'Site web']);
  check('elle est ecrite en 4e colonne', m.ecrites, [{ colonne: 4, valeur: 'Site web' }]);
}

{
  const m = monterEnsureColumns(['Email', 'Nom']);
  m.ensureColumns({ Email: 'a@b.c', Nom: 'Ada' });

  check('rien a ajouter quand tout existe', m.ajoutees, []);
  check('aucune ecriture inutile', m.ecrites.length, 0);
}

{
  // La tolerance de forme s'applique ici aussi : « Telephone » et
  // « Téléphone » sont la meme colonne, et la creer en double serait pire
  // que de ne rien faire.
  const m = monterEnsureColumns(['Email', 'Téléphone']);
  m.ensureColumns({ Email: 'a@b.c', Telephone: '+229' });

  check('accents et casse ne creent pas de doublon', m.ajoutees, []);
}

{
  const m = monterEnsureColumns(['Email']);
  m.ensureColumns({ Email: 'a@b.c', Bio: 'x', 'Site web': 'y' });

  check('plusieurs colonnes ajoutees dans l ordre recu', m.ajoutees, ['Bio', 'Site web']);
  check(
    'chacune a sa position',
    m.ecrites,
    [{ colonne: 2, valeur: 'Bio' }, { colonne: 3, valeur: 'Site web' }],
  );
}

{
  // Une feuille vide est traitee ailleurs, par la creation de la ligne
  // d'en-tetes : `ensureColumns` doit s'abstenir plutot que d'inventer.
  const m = monterEnsureColumns([]);
  m.ensureColumns({ Email: 'a@b.c' });

  check('feuille sans en-tetes : abstention', m.ecrites.length, 0);
}

console.log(`\n=== ${passed} reussis, ${failed} echoues ===`);
if (failed > 0) process.exit(1);
