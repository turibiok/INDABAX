/**
 * Verifie le registre de la plateforme.
 *
 * Il decide a qui appartient quel evenement. Une erreur ici ne fait pas
 * planter l'application : elle donne l'evenement de quelqu'un a quelqu'un
 * d'autre.
 *
 * Sans `DATABASE_URL`, seule la fabrication des identifiants d'URL est
 * verifiee — le reste demande une base, et le dire vaut mieux que de le
 * simuler.
 */

import { fermerBase, preparerBase, query } from './db';
import {
  composerCompte,
  comptePlateforme,
  enregistrerCompte,
  enregistrerEvenement,
  EventRecord,
  evenementParSlug,
  evenementsDe,
  evenementsPublics,
  slugDisponible,
  versSlug,
} from './platform';

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

console.log('\n--- versSlug ---');

check('accents retires', versSlug('Forum Numérique Bénin'), 'forum-numerique-benin');
check('ponctuation remplacee', versSlug('IA & Santé : 2027'), 'ia-sante-2027');
check('tirets de bord retires', versSlug('  --Hackathon--  '), 'hackathon');
check('chaine vide reste vide', versSlug(''), '');
check('emoji et symboles ecartes', versSlug('Tech 🚀 Event'), 'tech-event');
check('longueur bornee', versSlug('a'.repeat(200)).length, 60);

/** Un evenement complet, pour ne pas repeter quinze champs a chaque essai. */
function evenement(patch: Partial<EventRecord>): EventRecord {
  return {
    slug: `${P}-defaut`,
    name: 'Essai',
    edition: '2027',
    startDate: '2027-05-01',
    endDate: '2027-05-03',
    location: 'Cotonou',
    summary: '',
    ownerEmail: `a@${P}.invalid`,
    status: 'draft',
    sheetUrl: '',
    appsScriptUrl: '',
    logoUrl: '',
    posterUrl: '',
    primaryColor: '#047857',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

/**
 * Ces verifications demandent PostgreSQL.
 *
 * pg-mem n'accepte ni `NULLIF(...)::date` dans une insertion, ni la clause
 * `ON CONFLICT ... DO UPDATE` telle qu'elle est ecrite ici. Plutot que de
 * tordre le code pour qu'un double l'accepte — ce qui reviendrait a ecrire
 * pour l'outil de test et non pour la base reelle — elles s'executent contre
 * une vraie base, ou pas du tout.
 */
const VRAIE_BASE = Boolean((process.env.DATABASE_URL || '').trim());

/** Prefixe propre a cette execution, pour ne rien ecraser dans une base qui sert. */
const P = `essai-${Date.now().toString(36)}`;

async function nettoyer() {
  await query(`DELETE FROM events WHERE slug LIKE $1`, [`${P}%`]);
  await query(`DELETE FROM platform_accounts WHERE email LIKE $1`, [`%@${P}.invalid`]);
}

async function main() {
  if (!VRAIE_BASE) {
    console.log(
      '\n  ????  registre non vérifié — lancez avec DATABASE_URL pour exercer la base',
    );
    console.log(`\n=== ${reussis} reussis, ${echoues} echoues ===`);
    if (echoues > 0) process.exit(1);
    return;
  }

  await preparerBase();
  await nettoyer();

  console.log('\n--- comptes ---');

  await enregistrerCompte(composerCompte({
    email: `Alice@${P}.INVALID`,
    name: 'Alice',
    role: 'organizer',
    passwordHash: 'scrypt$aaa$bbb',
    createdAt: new Date().toISOString(),
    suspended: false,
  }));

  const alice = await comptePlateforme(`alice@${P}.invalid`);
  check("l'email est normalisé à l'écriture", alice?.email, `alice@${P}.invalid`);
  check('le rôle est conservé', alice?.role, 'organizer');

  const retrouvee = await comptePlateforme(`ALICE@${P}.INVALID`);
  check('et la recherche ignore la casse', retrouvee?.email, `alice@${P}.invalid`);

  check('un compte inconnu ne renvoie rien', await comptePlateforme(`personne@${P}.invalid`), undefined);

  {
    // Renommer un compte ne doit pas effacer son mot de passe : l'ecran qui
    // change le nom n'a aucune raison de connaitre l'empreinte.
    await enregistrerCompte(composerCompte({
      email: `alice@${P}.invalid`,
      name: 'Alice Modifiée',
      role: 'organizer',
      createdAt: new Date().toISOString(),
      suspended: false,
    }));

    const apres = await comptePlateforme(`alice@${P}.invalid`);
    check('le nom change', apres?.name, 'Alice Modifiée');
    check("l'empreinte survit", apres?.passwordHash, 'scrypt$aaa$bbb');
  }

  console.log('\n--- événements ---');

  await enregistrerCompte(composerCompte({
    email: `bob@${P}.invalid`,
    name: 'Bob',
    role: 'organizer',
    createdAt: new Date().toISOString(),
    suspended: false,
  }));

  await enregistrerEvenement(
    evenement({ slug: `${P}-forum`, name: 'Forum', ownerEmail: `alice@${P}.invalid`, status: 'published' }),
  );
  await enregistrerEvenement(
    evenement({ slug: `${P}-atelier`, name: 'Atelier', ownerEmail: `alice@${P}.invalid` }),
  );
  await enregistrerEvenement(
    evenement({ slug: `${P}-hack`, name: 'Hack', ownerEmail: `bob@${P}.invalid`, status: 'published' }),
  );

  // La base peut contenir d'autres evenements : on ne juge que les siens.
  const publics = (await evenementsPublics()).filter(e => e.slug.startsWith(P));
  check('seuls les publiés sont publics', publics.map(e => e.slug).sort(), [`${P}-forum`, `${P}-hack`]);

  const dAlice = await evenementsDe(`alice@${P}.invalid`);
  check(
    'chacun ne voit que les siens',
    dAlice.map(e => e.slug).sort(),
    [`${P}-atelier`, `${P}-forum`],
  );

  check('un brouillon reste accessible à son propriétaire', dAlice.some(e => e.status === 'draft'), true);

  {
    const lu = await evenementParSlug(`${P}-forum`);
    check('les dates traversent la base', [lu?.startDate, lu?.endDate], ['2027-05-01', '2027-05-03']);
  }

  {
    /*
     * Le cas qui compte : renvoyer un evenement existant avec un autre
     * proprietaire ne doit pas le lui donner. Sans cela, il suffirait de
     * connaitre un identifiant pour s'approprier l'evenement d'un autre.
     */
    await enregistrerEvenement(
      evenement({ slug: `${P}-forum`, name: 'Forum détourné', ownerEmail: `bob@${P}.invalid` }),
    );

    const apres = await evenementParSlug(`${P}-forum`);
    check('le propriétaire ne se transmet pas', apres?.ownerEmail, `alice@${P}.invalid`);
    check('mais le reste se modifie bien', apres?.name, 'Forum détourné');
  }

  console.log('\n--- identifiants disponibles ---');

  check(
    'un nom libre donne son identifiant',
    await slugDisponible('Congrès Vert Inédit', '2099'),
    'congres-vert-inedit-2099',
  );
  check(
    'un identifiant pris reçoit un suffixe',
    await slugDisponible(P, 'forum'),
    `${P}-forum-2`,
  );

  await nettoyer();
  await fermerBase();

  console.log(`\n=== ${reussis} reussis, ${echoues} echoues ===`);
  if (echoues > 0) process.exit(1);
}

main().catch(e => {
  console.log('échec du test : ' + (e?.stack || e));
  process.exit(1);
});
