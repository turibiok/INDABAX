import {
  buildCsvUrl,
  buildHtmlViewUrl,
  extractGid,
  extractGidsFromHtml,
  extractSpreadsheetId,
  isAllowedGoogleUrl,
  mapUserAccounts,
  normalizeHeader,
  parseCsv,
  parseRole,
  parseStatus,
  parseTabRef,
  scoreHeaders,
  toTable,
} from './sheets';
import { SHEET_TEMPLATES, templateToCsv } from '../data/sheetTemplates';

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
  'Nom complet,Adresse Email,Rôle,Statut,Mot de passe,Organisation',
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
check('mot de passe lu', accounts[0].password, 'SECRET1');
check('institution lue', accounts[0].institution, 'Sèmè City');
check('conferenciere -> speaker', accounts[1].role, 'speaker');
check('pas de mot de passe -> undefined', accounts[1].password, undefined);
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

/* ------------------------------------------------------------------ *
 * Les modeles documentes doivent etre relisibles par l'application :
 * ce que l'on montre aux organisateurs et ce que le code sait lire ne
 * peuvent pas divulguer.
 * ------------------------------------------------------------------ */

console.log('\n--- Aller-retour des modeles de feuilles ---');

for (const template of SHEET_TEMPLATES) {
  const table = toTable(parseCsv(templateToCsv(template)));

  check(
    `${template.tab} : en-tetes preserves`,
    table.headers,
    template.headers.map(normalizeHeader),
  );

  // Une ligne d'exemple plus courte que ses en-tetes decalerait tout ce qui
  // la suit dans le CSV telecharge par les organisateurs. C'est arrive en
  // ajoutant une colonne sans completer les exemples.
  check(
    `${template.tab} : lignes d exemple alignees sur les en-tetes`,
    template.rows.filter(row => row.length !== template.headers.length).length,
    0,
  );
  check(`${template.tab} : ${template.rows.length} ligne(s) relues`, table.rows.length, template.rows.length);

  for (const required of template.requiredColumns) {
    const key = normalizeHeader(required);
    const renseignees = table.rows.filter(row => row[key]).length;
    check(`${template.tab} : colonne ${required} renseignee partout`, renseignees, template.rows.length);
  }
}

console.log('\n--- Le modele Participants produit des comptes exploitables ---');

const profilesTemplate = SHEET_TEMPLATES.find(t => t.tab === 'Participants')!;
const templateAccounts = mapUserAccounts(toTable(parseCsv(templateToCsv(profilesTemplate))));

check('tous les comptes du modele sont reconnus', templateAccounts.length, profilesTemplate.rows.length);

// Le modele livre des empreintes vides : chaque personne choisit son mot de
// passe elle-meme. Aucun secret ne doit donc sortir de cette lecture.
check(
  'aucun mot de passe ni empreinte dans le modele',
  templateAccounts.filter(account => account.password || account.passwordHash).length,
  0,
);
check(
  'les informations de profil accompagnent le compte',
  templateAccounts.filter(a => a.city && a.country && a.interests && a.interests.length > 0).length,
  profilesTemplate.rows.length,
);
check(
  'les six roles du modele sont couverts',
  Array.from(new Set(templateAccounts.map(account => account.role))).sort(),
  ['attendee', 'organizer', 'speaker', 'sponsor', 'super-admin', 'volunteer'],
);
check(
  'le statut en attente est reconnu',
  templateAccounts.filter(account => account.status === 'pending').length,
  1,
);
/* ------------------------------------------------------------------ *
 * Adressage des onglets.
 *
 * Sur un classeur simplement partage par lien, Google ignore le parametre
 * `sheet=` et renvoie toujours l'onglet par defaut. Un onglet doit donc
 * pouvoir etre designe par son gid, et reconnu a ses colonnes.
 * ------------------------------------------------------------------ */

console.log('\n--- parseTabRef ---');
check('nom d onglet', parseTabRef('Utilisateurs'), { tab: 'Utilisateurs' });
check('gid numerique', parseTabRef('644285085'), { gid: '644285085' });
check(
  'URL d onglet collee',
  parseTabRef('https://docs.google.com/spreadsheets/d/ABC/edit#gid=934049423'),
  { gid: '934049423' },
);
check('espaces autour du gid', parseTabRef('  771029365  '), { gid: '771029365' });
check('nom contenant des chiffres', parseTabRef('Salle 2'), { tab: 'Salle 2' });

console.log('\n--- extractGidsFromHtml ---');
check(
  'gid extraits et dedoublonnes',
  extractGidsFromHtml(
    '<a href="?gid=644285085">x</a><a href="#gid=771029365">y</a><a href="?gid=644285085">z</a>',
  ),
  ['644285085', '771029365'],
);
check('aucun gid', extractGidsFromHtml('<html><body>rien</body></html>'), []);

console.log('\n--- buildHtmlViewUrl ---');
check(
  'URL de la page des onglets',
  buildHtmlViewUrl('ID1'),
  'https://docs.google.com/spreadsheets/d/ID1/htmlview',
);

console.log('\n--- scoreHeaders ---');
const headersOf = (tab: string) => SHEET_TEMPLATES.find(t => t.tab === tab)!.headers;

const PROFILS = headersOf('Participants');
const ANNONCES = headersOf('Annonces');
const MESSAGES = headersOf('Messages');

check('un onglet se reconnait a lui-meme', scoreHeaders(PROFILS, PROFILS), 1);

/*
 * La paire a risque du classeur : Annonces et Messages tiennent tous deux un
 * identifiant, un horodateur, un auteur, son email, son role, un message, un
 * indicateur de retrait et une colonne de reactions. Huit colonnes communes
 * sur les onze attendues pour Annonces : au-dessus d'un seuil naif, ce qui
 * justifie le seuil d'acceptation eleve (0,85) cote serveur. Sans lui, une
 * lecture des annonces pourrait rendre le fil des messages.
 */
check('recouvrement mesure entre Annonces et Messages', scoreHeaders(MESSAGES, ANNONCES), 8 / 11);
check(
  'ce recouvrement reste sous le seuil d acceptation par le nom',
  scoreHeaders(MESSAGES, ANNONCES) < 0.85,
  true,
);
check(
  'le bon onglet devance toujours les autres',
  scoreHeaders(ANNONCES, ANNONCES) > scoreHeaders(MESSAGES, ANNONCES),
  true,
);
check(
  'et le classement tranche dans l autre sens aussi',
  scoreHeaders(MESSAGES, MESSAGES) > scoreHeaders(ANNONCES, MESSAGES),
  true,
);
check('accents et casse ignores', scoreHeaders(['EMAIL', 'Rôle'], ['email', 'role']), 1);
check('colonnes absentes', scoreHeaders([], PROFILS), 0);
check('attente vide', scoreHeaders(PROFILS, []), 0);

/*
 * Cas reel qui a motive la correction : le classeur renvoyait son premier
 * onglet, alors nomme Participants, quand l application demandait
 * Utilisateurs. Les deux onglets sont depuis fusionnes, mais le classement
 * doit continuer a trancher entre deux tables qui se ressemblent.
 */
const ONGLET_RENVOYE = ['ID', 'Billet', 'Nom', 'Email', 'Role', 'Institution', 'Poste', 'Pays', 'Ville', 'Interets'];

check(
  'un onglet incomplet n est pas accepte sur son nom',
  scoreHeaders(ONGLET_RENVOYE, PROFILS) < 0.85,
  true,
);
check(
  'et l onglet complet le devance',
  scoreHeaders(PROFILS, PROFILS) > scoreHeaders(ONGLET_RENVOYE, PROFILS),
  true,
);
check(
  'le programme ne peut pas passer pour l annuaire',
  scoreHeaders(headersOf('Sessions'), PROFILS) < 0.5,
  true,
);
console.log(`\n=== ${passed} reussis, ${failed} echoues ===`);
if (failed > 0) process.exit(1);
