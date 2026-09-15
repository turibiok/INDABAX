/**
 * Verifie la lecture de la configuration d'evenement depuis le classeur.
 *
 * Ces fonctions decident des droits de chacun a partir d'une feuille remplie a
 * la main : elles doivent tolerer les libelles approximatifs sans jamais
 * accorder un pouvoir que personne n'a ecrit, ni laisser un evenement sans
 * moyen de se corriger.
 */

import {
  configDepuisLignes,
  configVersLignes,
  rolesDepuisLignes,
  rolesVersLignes,
} from './eventConfig';
import { DEFAULT_ROLES, DEFAULT_TERMINOLOGY } from '../src/permissions';
import { EventRole } from '../src/types';

let reussis = 0;
let echoues = 0;

function check(label: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) {
    reussis++;
    console.log('  OK   ' + label);
  } else {
    echoues++;
    console.log('  ECHEC ' + label);
    console.log('        attendu : ' + JSON.stringify(attendu));
    console.log('        obtenu  : ' + JSON.stringify(obtenu));
  }
}

const roleDe = (roles: EventRole[], id: string) => roles.find(r => r.id === id);

/* ------------------------------------------------------------------ *
 * Les roles
 * ------------------------------------------------------------------ */

console.log('\n--- rolesDepuisLignes : les roles livres survivent ---');

{
  // Feuille vide : rien ne doit disparaitre, sans quoi les comptes deja
  // enregistres perdraient leur role du jour au lendemain.
  const { roles } = rolesDepuisLignes([]);
  check(
    'les six roles livres restent',
    roles.map(r => r.id).sort(),
    DEFAULT_ROLES.map(r => r.id).sort(),
  );
}

{
  // Une feuille qui ne mentionne qu'un role ne supprime pas les autres.
  const { roles } = rolesDepuisLignes([
    { ID: 'attendee', 'Libellé': 'Stagiaire', Espace: 'attendee', Teinte: 'ciel' },
  ]);

  check('le role cite est bien modifie', roleDe(roles, 'attendee')?.label, 'Stagiaire');
  check('sa teinte est prise en compte', roleDe(roles, 'attendee')?.accent, 'ciel');
  check('les autres roles livres restent', roles.length, DEFAULT_ROLES.length);
  check(
    "l'organisateur garde ses droits",
    roleDe(roles, 'organizer')?.canManageContent,
    true,
  );
}

console.log('\n--- un role cree de toutes pieces ---');

{
  const { roles } = rolesDepuisLignes([
    {
      ID: 'jury',
      'Libellé': 'Jury',
      Espace: 'speaker',
      Teinte: 'rose',
      Onglets: 'schedule, profile',
      Scanner: 'oui',
      'Voir tous les avis': 'oui',
    },
  ]);

  const jury = roleDe(roles, 'jury');
  check('le role est cree', jury?.label, 'Jury');
  check("il reutilise l'espace demande", jury?.dashboard, 'speaker');
  check('ses onglets sont ceux demandes', jury?.tabs, ['schedule', 'profile']);
  check('le droit accorde est accorde', jury?.canScan, true);
  check('le droit non ecrit est refuse', jury?.canManageContent, false);
  check("il n'est pas marque comme livre", jury?.builtIn, false);
}

console.log('\n--- tolerance des libelles ---');

{
  // Accents, casse et espaces varient d'un classeur a l'autre : les refuser
  // reviendrait a pieger l'organisateur sans le lui dire.
  const { roles } = rolesDepuisLignes([
    { id: 'jury', libelle: 'Jury', 'gerer roles': 'VRAI', scanner: '1' },
  ]);

  const jury = roleDe(roles, 'jury');
  check('en-tetes sans accents reconnus', jury?.label, 'Jury');
  check('« VRAI » vaut oui', jury?.canManageRoles, true);
  check('« 1 » vaut oui', jury?.canScan, true);
}

{
  const { roles } = rolesDepuisLignes([
    { ID: 'jury', 'Libellé': 'Jury', Onglets: 'TOUS' },
  ]);
  check('« tous » ouvre tous les onglets', roleDe(roles, 'jury')?.tabs.length, 8);
}

console.log('\n--- garde-fous ---');

{
  // Une feuille qui retire le dernier droit de gerer les roles enfermerait
  // l'evenement : plus personne ne pourrait la corriger depuis l'application.
  const lignes = rolesVersLignes(DEFAULT_ROLES).map(ligne => ({
    ...ligne,
    'Gérer rôles': 'non',
  }));

  const { roles, avertissements } = rolesDepuisLignes(lignes);

  check('la table est refusee', roles, DEFAULT_ROLES);
  check('et le refus est explique', avertissements.length > 0, true);
}

{
  const { roles } = rolesDepuisLignes([{ 'Libellé': 'Sans identifiant' }]);
  check('une ligne sans ID est ignoree', roles.length, DEFAULT_ROLES.length);
}

{
  const { roles } = rolesDepuisLignes([{ ID: 'jury' }]);
  check('un role sans libelle est ignore', roleDe(roles, 'jury'), undefined);
}

{
  const { roles } = rolesDepuisLignes([
    { ID: 'jury', 'Libellé': 'Jury', Onglets: 'inexistant, autre' },
  ]);
  check('des onglets inconnus laissent le profil', roleDe(roles, 'jury')?.tabs, ['profile']);
}

{
  const { roles } = rolesDepuisLignes([
    { ID: 'jury', 'Libellé': 'Jury', Espace: 'inconnu', Teinte: 'fuchsia' },
  ]);
  check('un espace inconnu retombe sur participant', roleDe(roles, 'jury')?.dashboard, 'attendee');
  check('une teinte inconnue retombe sur ardoise', roleDe(roles, 'jury')?.accent, 'ardoise');
}

{
  // Le super-admin reste modifiable dans son libelle, mais reste present.
  const { roles } = rolesDepuisLignes([
    { ID: 'super-admin', 'Libellé': 'Direction', 'Gérer rôles': 'oui' },
  ]);
  check('un role livre peut etre renomme', roleDe(roles, 'super-admin')?.label, 'Direction');
  check('et reste marque comme livre', roleDe(roles, 'super-admin')?.builtIn, true);
}

console.log('\n--- aller-retour ---');

{
  // Ce que le serveur ecrit doit se relire a l'identique, sans quoi une
  // sauvegarde depuis l'application deformerait les droits en silence.
  const { roles } = rolesDepuisLignes(rolesVersLignes(DEFAULT_ROLES));

  check(
    'les droits traversent l ecriture puis la lecture',
    roles.map(r => [r.id, r.canScan, r.canManageRoles, r.tabs.length]),
    DEFAULT_ROLES.map(r => [r.id, r.canScan, r.canManageRoles, r.tabs.length]),
  );
  check(
    'les libelles et teintes aussi',
    roles.map(r => [r.label, r.accent, r.dashboard]),
    DEFAULT_ROLES.map(r => [r.label, r.accent, r.dashboard]),
  );
}

/* ------------------------------------------------------------------ *
 * L'identite et le vocabulaire
 * ------------------------------------------------------------------ */

console.log('\n--- configDepuisLignes ---');

{
  const { identity, terminology, branding } = configDepuisLignes([
    { 'Clé': 'eventName', Valeur: 'Hackathon Cotonou' },
    { 'Clé': 'startDate', Valeur: '2027-03-01' },
    { 'Clé': 'term.session', Valeur: 'atelier' },
    { 'Clé': 'term.checkIn', Valeur: 'pointage' },
    { 'Clé': 'primaryColor', Valeur: '#123456' },
  ]);

  check("le nom de l'evenement est lu", identity.eventName, 'Hackathon Cotonou');
  check('la date aussi', identity.startDate, '2027-03-01');
  check('le mot « session » devient « atelier »', terminology.session, 'atelier');
  check('le mot « émargement » devient « pointage »', terminology.checkIn, 'pointage');
  check('le mot non cite garde sa valeur', terminology.schedule, DEFAULT_TERMINOLOGY.schedule);
  check('la couleur est lue', branding.primaryColor, '#123456');
}

{
  const { identity } = configDepuisLignes([
    { cle: 'eventname', valeur: 'Colloque' },
    { 'Clé': 'inconnue', Valeur: 'sans effet' },
  ]);
  check('en-tetes et cles tolerent la forme', identity.eventName, 'Colloque');
}

{
  // Une valeur vide ne doit pas effacer la valeur par defaut : une cellule
  // laissee vide est une absence de consigne, pas une consigne d'effacement.
  const { branding } = configDepuisLignes([{ 'Clé': 'primaryColor', Valeur: '' }]);
  check('une cellule vide laisse la valeur par defaut', branding.primaryColor, '#047857');
}

{
  const lignes = configVersLignes({
    identity: { ...configDepuisLignes([]).identity, eventName: 'Forum' },
    terminology: { ...DEFAULT_TERMINOLOGY, session: 'atelier' },
    branding: configDepuisLignes([]).branding,
  });

  const relu = configDepuisLignes(lignes);
  check('aller-retour : le nom tient', relu.identity.eventName, 'Forum');
  check('aller-retour : le mot tient', relu.terminology.session, 'atelier');
}

console.log(`\n=== ${reussis} reussis, ${echoues} echoues ===`);

if (echoues > 0) process.exit(1);
