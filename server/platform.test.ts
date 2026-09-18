/**
 * Verifie le registre de la plateforme.
 *
 * Ces fonctions decident a qui appartient quel evenement, et qui peut se
 * connecter. Une erreur ici ne fait pas planter l'application : elle donne
 * l'evenement de quelqu'un a quelqu'un d'autre.
 */

import {
  compteDepuisLigne,
  compteVersLigne,
  evenementDepuisLigne,
  evenementVersLigne,
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

console.log('\n--- evenementDepuisLigne ---');

{
  const e = evenementDepuisLigne({
    Identifiant: 'indabax-benin-2026',
    Nom: 'IndabaX Bénin',
    'Édition': '2026',
    'Début': '2026-09-18',
    Fin: '2026-09-20',
    Lieu: 'Cotonou',
    Organisateur: 'Contact@IndabaX.BJ',
    Statut: 'publié',
    Classeur: 'https://docs.google.com/spreadsheets/d/XYZ/edit',
    Affiche: 'https://exemple.org/affiche.jpg',
  });

  check("l'identifiant est repris", e?.slug, 'indabax-benin-2026');
  check('le nom aussi', e?.name, 'IndabaX Bénin');
  check("l'email du propriétaire est normalisé", e?.ownerEmail, 'contact@indabax.bj');
  check('« publié » vaut published', e?.status, 'published');
  check("l'affiche est conservée", e?.posterUrl, 'https://exemple.org/affiche.jpg');
  check('une couleur absente prend la valeur par défaut', e?.primaryColor, '#047857');
}

{
  // L'identifiant se deduit du nom quand la colonne est vide : un organisateur
  // qui remplit la feuille a la main ne devrait pas avoir a l'inventer.
  const e = evenementDepuisLigne({ Nom: 'Forum Numérique Bénin' });
  check("l'identifiant est déduit du nom", e?.slug, 'forum-numerique-benin');
}

{
  check('une ligne sans nom est ignorée', evenementDepuisLigne({ Identifiant: 'x' }), null);
  check('une ligne vide est ignorée', evenementDepuisLigne({}), null);
}

{
  // Un statut inconnu ne doit pas publier : le brouillon est le repli sur.
  const e = evenementDepuisLigne({ Nom: 'Essai', Statut: 'peut-être' });
  check('un statut inconnu reste un brouillon', e?.status, 'draft');
}

{
  const e = evenementDepuisLigne({ nom: 'Essai', statut: 'ARCHIVE', lieu: 'Porto-Novo' });
  check('en-têtes sans accents ni casse', e?.location, 'Porto-Novo');
  check('« ARCHIVE » vaut archived', e?.status, 'archived');
}

console.log('\n--- aller-retour événement ---');

{
  const avant = evenementDepuisLigne({
    Identifiant: 'forum-2027',
    Nom: 'Forum',
    'Édition': '2027',
    'Début': '2027-05-01',
    Fin: '2027-05-03',
    Lieu: 'Cotonou',
    'Résumé': 'Trois jours de rencontres.',
    Organisateur: 'moi@exemple.org',
    Statut: 'published',
    Classeur: 'https://docs.google.com/spreadsheets/d/ABC/edit',
    'Apps Script': 'https://script.google.com/macros/s/DEF/exec',
    Logo: 'https://exemple.org/logo.png',
    Affiche: 'https://exemple.org/affiche.png',
    Couleur: '#123456',
  })!;

  const apres = evenementDepuisLigne(evenementVersLigne(avant))!;

  check('tout traverse écriture puis relecture', apres, avant);
}

console.log('\n--- comptes de plateforme ---');

{
  const c = compteDepuisLigne({
    Email: 'Moi@Exemple.ORG',
    Nom: 'Moi',
    'Rôle': 'Organisateur',
    Empreinte: 'scrypt$aaa$bbb',
  });

  check("l'email est normalisé", c?.email, 'moi@exemple.org');
  check('le rôle est reconnu', c?.role, 'organizer');
  check("l'empreinte est conservée", c?.passwordHash, 'scrypt$aaa$bbb');
}

{
  // Un mot de passe en clair dans le registre donnerait acces a TOUS les
  // evenements : mieux vaut un compte inutilisable qu'un compte devinable.
  const c = compteDepuisLigne({ Email: 'moi@exemple.org', Empreinte: 'motdepasse' });
  check('un secret en clair est refusé', c?.passwordHash, undefined);
}

{
  const c = compteDepuisLigne({ Email: 'moi@exemple.org', 'Rôle': 'inconnu' });
  check('un rôle inconnu retombe sur membre', c?.role, 'member');
}

{
  check('une ligne sans email est ignorée', compteDepuisLigne({ Nom: 'Personne' }), null);
  check('une adresse sans arobase est ignorée', compteDepuisLigne({ Email: 'pas-un-email' }), null);
}

{
  const c = compteDepuisLigne({ Email: 'moi@exemple.org', Suspendu: 'oui' });
  check('la suspension est lue', c?.suspended, true);
}

{
  const avant = compteDepuisLigne({
    Email: 'moi@exemple.org',
    Nom: 'Moi',
    'Rôle': 'admin',
    Empreinte: 'scrypt$aaa$bbb',
    Suspendu: 'non',
  })!;

  const apres = compteDepuisLigne(compteVersLigne(avant))!;
  check('aller-retour du compte', apres, avant);
}

console.log(`\n=== ${reussis} reussis, ${echoues} echoues ===`);

if (echoues > 0) process.exit(1);
