/**
 * Verifie la billetterie contre une vraie base PostgreSQL en memoire.
 *
 * L'enjeu tient en une phrase : deux personnes achetent le dernier billet au
 * meme instant. Sur une feuille de calcul, les deux passent et l'organisateur
 * rembourse. Ces tests exigent que la seconde soit refusee.
 */

import { newDb } from 'pg-mem';

import { fermerBase, lireSchema, preparerBase, query, setPool } from './db';
import {
  annulerCommande,
  codeDeBillet,
  creerTypeDeBillet,
  marquerPayee,
  passerCommande,
  typesDeBillets,
  validerBillet,
} from './tickets';

let reussis = 0;
let echoues = 0;
let nonVerifies = 0;

/**
 * Contre quoi ces tests s'executent.
 *
 * Sans `DATABASE_URL`, une base en memoire suffit a tout verifier sauf une
 * chose : pg-mem n'honore pas `ROLLBACK`, et une transaction interrompue y
 * laisse ses ecritures. L'atomicite d'une commande a plusieurs lignes est donc
 * annoncee comme non verifiee plutot qu'affaiblie jusqu'a passer — ce qui
 * reviendrait a affirmer le contraire de ce qu'on veut.
 *
 * Avec `DATABASE_URL`, c'est cette base qui sert, et l'assertion s'execute
 * pour de bon. Le drapeau doit donc commander le choix de la base, et pas
 * seulement celui des assertions : les separer a deja produit un echec qui
 * accusait le code alors que le banc d'essai etait en cause.
 */
const VRAIE_BASE = Boolean((process.env.DATABASE_URL || '').trim());

/** Identifiant propre a cette execution, pour ne rien ecraser dans une vraie base. */
const EVENEMENT = VRAIE_BASE ? `essai-${Date.now().toString(36)}` : 'forum-2027';
const PROPRIETAIRE = `${EVENEMENT}@essai.invalid`;

function nonVerifie(label: string, pourquoi: string) {
  nonVerifies++;
  console.log('  ????  ' + label + ' — ' + pourquoi);
}

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

async function attendEchec(label: string, travail: () => Promise<unknown>, motif: string) {
  try {
    await travail();
    echoues++;
    console.log('  ECHEC ' + label + ' — aucune erreur levée');
  } catch (erreur: any) {
    const texte = String(erreur?.message || erreur);
    if (texte.toLowerCase().includes(motif.toLowerCase())) {
      reussis++;
      console.log('  OK   ' + label);
    } else {
      echoues++;
      console.log('  ECHEC ' + label + ' — message inattendu : ' + texte);
    }
  }
}

/** Efface ce que cette execution a laisse dans une vraie base. */
async function nettoyer() {
  if (!VRAIE_BASE) return;

  await query(`DELETE FROM tickets WHERE event_slug = $1`, [EVENEMENT]);
  await query(`DELETE FROM orders WHERE event_slug = $1`, [EVENEMENT]);
  await query(`DELETE FROM ticket_types WHERE event_slug = $1`, [EVENEMENT]);
  await query(`DELETE FROM events WHERE slug = $1`, [EVENEMENT]);
  await query(`DELETE FROM platform_accounts WHERE email = $1`, [PROPRIETAIRE]);
}

async function main() {
  if (VRAIE_BASE) {
    console.log(`
(base réelle, événement « ${EVENEMENT} »)`);

    await preparerBase();
    await nettoyer();

    await query(`INSERT INTO platform_accounts (email, name, role) VALUES ($1, 'Essai', 'organizer')`, [
      PROPRIETAIRE,
    ]);
    await query(`INSERT INTO events (slug, name, owner_email) VALUES ($1, 'Essai', $2)`, [
      EVENEMENT,
      PROPRIETAIRE,
    ]);
  } else {
    const db = newDb();

    // pg-mem ne fournit pas ces fonctions : on les declare, faute de quoi le
    // schema et les requetes echouent pour une raison sans rapport avec ce
    // qu'on veut verifier.
    db.public.registerFunction({ name: 'now', returns: 'timestamptz' as never, implementation: () => new Date() });
    db.public.registerFunction({
      name: 'gen_random_uuid',
      returns: 'uuid' as never,
      implementation: () => crypto.randomUUID(),
    });

    /*
     * A savoir avant de toucher aux requetes : pg-mem evalue mal `GREATEST` et
     * `CASE WHEN`, qui rendent 0 la ou PostgreSQL rend la bonne valeur. Le code
     * les evite donc, au profit de gardes dans le `WHERE` — qui sont d'ailleurs
     * plus sures, refusant l'ecriture au lieu de l'ecreter en silence.
     */
    const { Pool } = db.adapters.createPg();
    setPool(new Pool() as never);

    db.public.none(lireSchema());

    // Un evenement et son proprietaire : les billets y sont rattaches.
    db.public.none(`
      INSERT INTO platform_accounts (email, name, role) VALUES ('${PROPRIETAIRE}', 'Essai', 'organizer');
      INSERT INTO events (slug, name, owner_email) VALUES ('${EVENEMENT}', 'Essai', '${PROPRIETAIRE}');
    `);
  }

  console.log('\n--- codes de billet ---');

  const code = codeDeBillet('FORUM');
  check('le code porte le préfixe', code.startsWith('FORUM-'), true);
  check('il ne contient ni O ni 0 ni I ni 1', /[OI01]/.test(code.split('-').slice(1).join('')), false);
  check('deux codes diffèrent', codeDeBillet('X') === codeDeBillet('X'), false);

  console.log('\n--- types de billets ---');

  const gratuit = await creerTypeDeBillet({
    eventSlug: EVENEMENT,
    name: 'Accès libre',
    quantityTotal: null,
  });
  const limite = await creerTypeDeBillet({
    eventSlug: EVENEMENT,
    name: 'Atelier',
    priceMinor: 5000,
    quantityTotal: 2,
  });

  check('le gratuit est à zéro', gratuit.priceMinor, 0);
  check('son stock est illimité', gratuit.remaining, null);
  check('le payant a son prix', limite.priceMinor, 5000);
  check('et son stock', limite.remaining, 2);

  await attendEchec('un billet sans nom est refusé', () =>
    creerTypeDeBillet({ eventSlug: EVENEMENT, name: '  ' }), 'nom');

  console.log('\n--- commande gratuite ---');

  const c1 = await passerCommande({
    eventSlug: EVENEMENT,
    buyerEmail: 'Alice@Exemple.ORG',
    buyerName: 'Alice',
    lines: [{ ticketTypeId: gratuit.id, quantity: 2 }],
    codePrefix: 'FORUM',
  });

  check("l'email est normalisé", c1.order.buyerEmail, 'alice@exemple.org');
  check('deux billets émis', c1.tickets.length, 2);
  check('une commande gratuite est payée aussitôt', c1.order.status, 'paid');
  check('son total est nul', c1.order.totalMinor, 0);
  check('les codes diffèrent', c1.tickets[0].code === c1.tickets[1].code, false);

  console.log('\n--- commande payante ---');

  const c2 = await passerCommande({
    eventSlug: EVENEMENT,
    buyerEmail: 'bob@exemple.org',
    lines: [{ ticketTypeId: limite.id, quantity: 1 }],
  });

  check('elle reste en attente', c2.order.status, 'pending');
  check('son total est calculé', c2.order.totalMinor, 5000);

  const apresBob = (await typesDeBillets(EVENEMENT)).find(t => t.id === limite.id);
  check('le stock est déjà réservé, paiement ou non', apresBob?.remaining, 1);

  console.log('\n--- le dernier billet ---');

  const c3 = await passerCommande({
    eventSlug: EVENEMENT,
    buyerEmail: 'carole@exemple.org',
    lines: [{ ticketTypeId: limite.id, quantity: 1 }],
  });
  check('la troisième prend le dernier', c3.tickets.length, 1);

  await attendEchec(
    'la quatrième est refusée, le stock étant épuisé',
    () =>
      passerCommande({
        eventSlug: EVENEMENT,
        buyerEmail: 'david@exemple.org',
        lines: [{ ticketTypeId: limite.id, quantity: 1 }],
      }),
    'épuisé',
  );

  const epuise = (await typesDeBillets(EVENEMENT)).find(t => t.id === limite.id);
  check('le stock vendu ne dépasse pas le total', epuise?.quantitySold, 2);
  check('et il ne reste rien', epuise?.remaining, 0);

  console.log('\n--- la survente, franchement ---');

  const serre = await creerTypeDeBillet({
    eventSlug: EVENEMENT,
    name: 'Place unique',
    priceMinor: 1000,
    quantityTotal: 1,
  });

  // Dix commandes lancees ensemble sur une seule place. Une seule doit passer.
  const tentatives = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      passerCommande({
        eventSlug: EVENEMENT,
        buyerEmail: `acheteur${i}@exemple.org`,
        lines: [{ ticketTypeId: serre.id, quantity: 1 }],
      }),
    ),
  );

  const passees = tentatives.filter(t => t.status === 'fulfilled').length;
  check('une seule des dix commandes aboutit', passees, 1);

  const apres = (await typesDeBillets(EVENEMENT)).find(t => t.id === serre.id);
  check('et le stock vendu vaut exactement un', apres?.quantitySold, 1);

  console.log('\n--- refus divers ---');

  const avantMixte = (await typesDeBillets(EVENEMENT)).find(t => t.id === gratuit.id)!.quantitySold;

  await attendEchec(
    'une demande dépassant le stock est refusée en bloc',
    () =>
      passerCommande({
        eventSlug: EVENEMENT,
        buyerEmail: 'eve@exemple.org',
        lines: [{ ticketTypeId: gratuit.id, quantity: 3 }, { ticketTypeId: serre.id, quantity: 1 }],
      }),
    'épuisé',
  );

  const gratuitApres = (await typesDeBillets(EVENEMENT)).find(t => t.id === gratuit.id);

  if (VRAIE_BASE) {
    check(
      "et la ligne gratuite de cette commande n'est pas comptée",
      gratuitApres?.quantitySold,
      avantMixte,
    );
  } else {
    nonVerifie(
      "la ligne gratuite d'une commande refusée n'est pas comptée",
      'pg-mem n’annule pas les transactions ; lancez ce test avec DATABASE_URL',
    );
  }

  await attendEchec('adresse invalide', () =>
    passerCommande({ eventSlug: EVENEMENT, buyerEmail: 'pas-un-email', lines: [{ ticketTypeId: gratuit.id, quantity: 1 }] }), 'email');

  await attendEchec('commande vide', () =>
    passerCommande({ eventSlug: EVENEMENT, buyerEmail: 'a@b.c', lines: [] }), 'Aucun billet');

  await attendEchec('plus de vingt billets', () =>
    passerCommande({ eventSlug: EVENEMENT, buyerEmail: 'a@b.c', lines: [{ ticketTypeId: gratuit.id, quantity: 21 }] }), 'maximum');

  await attendEchec('type de billet inconnu', () =>
    passerCommande({ eventSlug: EVENEMENT, buyerEmail: 'a@b.c', lines: [{ ticketTypeId: '999999', quantity: 1 }] }), "n’existe pas");

  console.log('\n--- paiement et annulation ---');

  const paye = await marquerPayee(c2.order.id, { ref: 'PAY-1', method: 'momo' });
  check('la commande devient payée', paye.status, 'paid');

  await attendEchec('un second paiement est refusé', () =>
    marquerPayee(c2.order.id, { ref: 'PAY-2' }), 'déjà réglée');

  const annulee = await annulerCommande(c3.order.id);
  check("l'annulation prend effet", annulee.status, 'cancelled');

  const rendu = (await typesDeBillets(EVENEMENT)).find(t => t.id === limite.id);
  check('le stock est rendu', rendu?.quantitySold, 1);

  await attendEchec('une double annulation est refusée', () =>
    annulerCommande(c3.order.id), 'déjà annulée');

  const toujours = (await typesDeBillets(EVENEMENT)).find(t => t.id === limite.id);
  check("et le stock n'est pas rendu deux fois", toujours?.quantitySold, 1);

  console.log('\n--- contrôle à l’entrée ---');

  const billet = c1.tickets[0];

  const premier = await validerBillet(EVENEMENT, billet.code);
  check('le billet passe', premier.ok, true);

  const second = await validerBillet(EVENEMENT, billet.code);
  check('il ne passe pas deux fois', second.ok, false);
  check('et on dit pourquoi', second.raison, 'Billet déjà utilisé.');

  const inconnu = await validerBillet(EVENEMENT, 'FORUM-ZZZZ-ZZZZ');
  check('un code inconnu est refusé', inconnu.raison, 'Billet inconnu.');

  const annule = await validerBillet(EVENEMENT, c3.tickets[0].code);
  check("un billet d'une commande annulée est refusé", annule.raison, 'Billet annulé.');

  // Le code en minuscules doit passer : on le recopie souvent a la main.
  const autre = c1.tickets[1];
  const minuscules = await validerBillet(EVENEMENT, autre.code.toLowerCase());
  check('un code saisi en minuscules est accepté', minuscules.ok, true);

  await nettoyer();
  await fermerBase();

  console.log(`\n=== ${reussis} reussis, ${echoues} echoues ===`);
  if (echoues > 0) process.exit(1);
}

main().catch(e => {
  console.log('échec du test : ' + (e?.stack || e));
  process.exit(1);
});
