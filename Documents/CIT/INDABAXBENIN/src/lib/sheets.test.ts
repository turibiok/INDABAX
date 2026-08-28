import {
  buildCsvUrl,
  extractGid,
  extractSpreadsheetId,
  isAllowedGoogleUrl,
  mapUserAccounts,
  normalizeHeader,
  parseCsv,
  parseRole,
  parseStatus,
  toTable,
} from './sheets';

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

console.log('\n--- extractSpreadsheetId ---');
check(
  'lien /edit',
  extractSpreadsheetId('https://docs.google.com/spreadsheets/d/1AbC-dEf_123456789012345678/edit#gid=0'),
  '1AbC-dEf_123456789012345678',
);
check(
  'lien publie /d/e/',
  extractSpreadsheetId('https://docs.google.com/spreadsheets/d/e/2PACX-1vABC123456789/pubhtml'),
  'e/2PACX-1vABC123456789',
);
check('ID brut', extractSpreadsheetId('1AbC-dEf_123456789012345678'), '1AbC-dEf_123456789012345678');
check('vide', extractSpreadsheetId(''), null);
check('non pertinent', extractSpreadsheetId('bonjour'), null);

console.log('\n--- extractGid ---');
check('gid en fragment', extractGid('https://docs.google.com/spreadsheets/d/X/edit#gid=1234567'), '1234567');
check('sans gid', extractGid('https://docs.google.com/spreadsheets/d/X/edit'), null);

console.log('\n--- buildCsvUrl ---');
check(
  'par nom d onglet',
  buildCsvUrl('ID1', { tab: 'Utilisateurs' }),
  'https://docs.google.com/spreadsheets/d/ID1/gviz/tq?tqx=out%3Acsv&sheet=Utilisateurs',
);
check(
  'par gid (prioritaire)',
  buildCsvUrl('ID1', { tab: 'Ignore', gid: '42' }),
  'https://docs.google.com/spreadsheets/d/ID1/gviz/tq?tqx=out%3Acsv&gid=42',
);
check(
  'onglet avec espace',
  buildCsvUrl('ID1', { tab: 'Check ins' }),
  'https://docs.google.com/spreadsheets/d/ID1/gviz/tq?tqx=out%3Acsv&sheet=Check+ins',
);

console.log('\n--- isAllowedGoogleUrl (anti-SSRF) ---');
check('docs.google.com', isAllowedGoogleUrl('https://docs.google.com/x'), true);
check('script.google.com', isAllowedGoogleUrl('https://script.google.com/macros/s/x/exec'), true);
check('http refuse', isAllowedGoogleUrl('http://docs.google.com/x'), false);
check('hote quelconque', isAllowedGoogleUrl('https://evil.example.com/x'), false);
check('metadonnees cloud', isAllowedGoogleUrl('http://169.254.169.254/'), false);
check('sous-domaine trompeur', isAllowedGoogleUrl('https://docs.google.com.evil.com/x'), false);

console.log('\n--- parseCsv ---');
check('simple', parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
check('guillemets et virgule', parseCsv('a,b\n"x, y",2'), [['a', 'b'], ['x, y', '2']]);
check('guillemet echappe', parseCsv('a\n"il dit ""oui"""'), [['a'], ['il dit "oui"']]);
check('saut de ligne dans un champ', parseCsv('a,b\n"l1\nl2",2'), [['a', 'b'], ['l1\nl2', '2']]);
check('CRLF', parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
check('ligne vide ignoree', parseCsv('a,b\n\n1,2\n,\n'), [['a', 'b'], ['1', '2']]);
check('champ vide final', parseCsv('a,b,c\n1,,3'), [['a', 'b', 'c'], ['1', '', '3']]);

console.log('\n--- normalizeHeader ---');
check('accents', normalizeHeader('Rôle'), 'role');
check('espaces', normalizeHeader('  Adresse Email  '), 'adresse_email');
check('apostrophe', normalizeHeader("Code d'accès"), 'code_d_acces');
check('majuscules accentuees', normalizeHeader('ÉTAT'), 'etat');

console.log('\n--- parseRole ---');
check('francais', parseRole('Organisateur'), 'organizer');
check('accentue', parseRole('Conférencier'), 'speaker');
check('benevole', parseRole('Bénévole'), 'volunteer');
check('admin', parseRole('Admin'), 'super-admin');
check('inconnu -> defaut', parseRole('Zzz'), 'attendee');
check('vide -> defaut', parseRole(''), 'attendee');

console.log('\n--- parseStatus ---');
check('actif', parseStatus('Actif'), 'active');
check('en attente', parseStatus('En attente'), 'pending');
check('suspendu', parseStatus('Suspendu'), 'suspended');
check('vide -> actif', parseStatus(''), 'active');

console.log('\n--- mapUserAccounts (en-tetes FR realistes) ---');
const csv = [
  'Nom complet,Adresse Email,Rôle,Statut,Code d\'accès,Organisation',
  'Turibio KEKE,MahuviviTuribioK@Gmail.com ,Admin,Actif,SECRET1,Sèmè City',
  'Amina Biotchané,amina.biotchane@uac.bj,Conférencière,Actif,,UAC',
  'Bob Volontaire,bob@indabax.bj,Bénévole,En attente,,',
  'Ligne sans email,,Participant,Actif,,',
  'Doublon,amina.biotchane@uac.bj,Participant,Actif,,',
].join('\n');

const accounts = mapUserAccounts(toTable(parseCsv(csv)));

check('nombre de comptes (doublon + ligne sans email ecartes)', accounts.length, 3);
check('email normalise en minuscules et trim', accounts[0].email, 'mahuvivituribiok@gmail.com');
check('role admin', accounts[0].role, 'super-admin');
check('code d acces lu', accounts[0].accessCode, 'SECRET1');
check('institution lue', accounts[0].institution, 'Sèmè City');
check('conferenciere -> speaker', accounts[1].role, 'speaker');
check('pas de code -> undefined', accounts[1].accessCode, undefined);
check('benevole -> volunteer', accounts[2].role, 'volunteer');
check('statut en attente', accounts[2].status, 'pending');
check('premier doublon conserve', accounts[1].name, 'Amina Biotchané');

console.log('\n--- mapUserAccounts (en-tetes EN) ---');
const csvEn = ['Email,Name,Role,Status', 'jane@x.org,Jane Doe,Speaker,Active'].join('\n');
const accountsEn = mapUserAccounts(toTable(parseCsv(csvEn)));
check('un compte', accountsEn.length, 1);
check('role EN', accountsEn[0].role, 'speaker');

console.log('\n--- nom deduit de l email ---');
const csvNoName = ['Email,Role', 'pierre.dupont@x.org,Participant'].join('\n');
const derived = mapUserAccounts(toTable(parseCsv(csvNoName)));
check('nom deduit', derived[0].name, 'pierre dupont');

console.log(`\n=== ${passed} reussis, ${failed} echoues ===`);
if (failed > 0) process.exit(1);
