/**
 * Verifie la signature des notifications FedaPay.
 *
 * C'est la seule chose qui empeche n'importe qui de declarer une commande
 * payee en devinant une adresse. Une faille ici ne se voit pas : les billets
 * partent, et le compte n'y est qu'au moment de faire les comptes.
 *
 * L'algorithme est celui du SDK officiel : HMAC-SHA256 sur « horodatage.corps »,
 * en-tete « t=…,s=… », tolerance de cinq minutes.
 */

import { createHmac } from 'crypto';

import {
  ErreurSignature,
  lireEnteteSignature,
  statutEstPaye,
  verifierSignature,
} from './fedapay';

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

function refuse(label: string, travail: () => void, motif: string) {
  try {
    travail();
    echoues++;
    console.log('  ECHEC ' + label + ' — acceptée alors qu’elle devait être refusée');
  } catch (erreur: any) {
    if (!(erreur instanceof ErreurSignature)) {
      echoues++;
      console.log('  ECHEC ' + label + ' — mauvais type d’erreur : ' + erreur?.name);
      return;
    }
    if (String(erreur.message).toLowerCase().includes(motif.toLowerCase())) {
      reussis++;
      console.log('  OK   ' + label);
    } else {
      echoues++;
      console.log('  ECHEC ' + label + ' — message inattendu : ' + erreur.message);
    }
  }
}

const SECRET = 'wh_secret_de_test';
const CORPS = JSON.stringify({ 'entity': { id: 42, status: 'approved' }, name: 'transaction.approved' });

/** Fabrique un en-tete comme FedaPay le produirait. */
function entete(corps: string, secret: string, horodatage = Math.floor(Date.now() / 1000)): string {
  const signature = createHmac('sha256', secret).update(`${horodatage}.${corps}`, 'utf8').digest('hex');
  return `t=${horodatage},s=${signature}`;
}

console.log('\n--- lecture de l en-tete ---');

{
  const lu = lireEnteteSignature('t=1700000000,s=abcdef');
  check('horodatage extrait', lu.horodatage, 1700000000);
  check('empreinte extraite', lu.signatures, ['abcdef']);
}

{
  // Pendant une rotation de secret, l'ancien et le nouveau coexistent.
  const lu = lireEnteteSignature('t=1700000000,s=aaa,s=bbb');
  check('plusieurs empreintes sont lues', lu.signatures, ['aaa', 'bbb']);
}

check('un en-tête vide ne donne rien', lireEnteteSignature('').horodatage, -1);
check('un en-tête absurde non plus', lireEnteteSignature('n’importe quoi').horodatage, -1);

console.log('\n--- signature valable ---');

{
  let leve = false;
  try {
    verifierSignature(CORPS, entete(CORPS, SECRET), SECRET);
  } catch {
    leve = true;
  }
  check('une notification authentique passe', leve, false);
}

{
  // Rotation en cours : la bonne empreinte est la seconde.
  const h = Math.floor(Date.now() / 1000);
  const bonne = createHmac('sha256', SECRET).update(`${h}.${CORPS}`, 'utf8').digest('hex');

  let leve = false;
  try {
    verifierSignature(CORPS, `t=${h},s=0000,s=${bonne}`, SECRET);
  } catch {
    leve = true;
  }
  check('une empreinte parmi plusieurs suffit', leve, false);
}

console.log('\n--- refus ---');

refuse('sans secret configuré', () => verifierSignature(CORPS, entete(CORPS, SECRET), ''), 'FEDAPAY_WEBHOOK_SECRET');

refuse(
  'signée avec un autre secret',
  () => verifierSignature(CORPS, entete(CORPS, 'un_autre_secret'), SECRET),
  'correspond',
);

refuse(
  'corps modifié après signature',
  () => verifierSignature(CORPS.replace('42', '43'), entete(CORPS, SECRET), SECRET),
  'correspond',
);

refuse('en-tête absent', () => verifierSignature(CORPS, '', SECRET), 'horodatage');
refuse('en-tête sans empreinte', () => verifierSignature(CORPS, 't=1700000000', SECRET), 'empreinte');

{
  /*
   * Le rejeu : une notification authentique, interceptee, renvoyee plus tard.
   * Sans borne de temps elle passerait indefiniment, et chaque renvoi pourrait
   * declencher une nouvelle livraison de billets.
   */
  const vieux = Math.floor(Date.now() / 1000) - 3600;
  refuse(
    'notification authentique mais vieille d’une heure',
    () => verifierSignature(CORPS, entete(CORPS, SECRET, vieux), SECRET),
    'rejeu',
  );
}

{
  // Un horodatage dans le futur est tout aussi suspect qu'un trop ancien.
  const futur = Math.floor(Date.now() / 1000) + 3600;
  refuse(
    'horodatage dans le futur',
    () => verifierSignature(CORPS, entete(CORPS, SECRET, futur), SECRET),
    'rejeu',
  );
}

{
  /*
   * Le corps signe doit etre le texte recu, au caractere pres.
   *
   * FedaPay peut envoyer un JSON indente, ou dans un ordre de cles qui n'est
   * pas celui que produirait `JSON.stringify`. Verifier contre une version
   * re-serialisee ferait donc echouer des notifications parfaitement
   * authentiques — panne intermittente et incomprehensible.
   */
  // Un JSON indente, comme une passerelle peut en envoyer : les espaces et
  // l'ordre des cles n'y sont pas ceux de `JSON.stringify`.
  const recu = `{
  "name": "transaction.approved",
  "entity": { "id": 42 }
}`;
  const enteteDuRecu = entete(recu, SECRET);

  let leveSurLeTexteRecu = false;
  try {
    verifierSignature(recu, enteteDuRecu, SECRET);
  } catch {
    leveSurLeTexteRecu = true;
  }
  check('le texte reçu tel quel est accepté', leveSurLeTexteRecu, false);

  const reserialise = JSON.stringify(JSON.parse(recu));
  check('la re-sérialisation change bien le texte', reserialise !== recu, true);

  refuse(
    'le même contenu re-sérialisé est refusé',
    () => verifierSignature(reserialise, enteteDuRecu, SECRET),
    'correspond',
  );
}

console.log('\n--- statuts ---');

check('« approved » vaut payé', statutEstPaye('approved'), true);
check('« transferred » aussi', statutEstPaye('transferred'), true);
check('« pending » non', statutEstPaye('pending'), false);
check('« canceled » non', statutEstPaye('canceled'), false);
check('« declined » non', statutEstPaye('declined'), false);
check('la casse est tolérée', statutEstPaye('APPROVED'), true);
check('un statut vide ne vaut pas payé', statutEstPaye(''), false);

console.log(`\n=== ${reussis} reussis, ${echoues} echoues ===`);
if (echoues > 0) process.exit(1);
