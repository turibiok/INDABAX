import {
  AppTab,
  BuiltInRole,
  EventRole,
  EventTerminology,
  ParticipantRole,
  RoleCapabilities,
} from './types';

// Reexportes : le serveur et plusieurs ecrans les importent depuis ici.
export type { AppTab, RoleCapabilities, EventRole };

const ALL_TABS: AppTab[] = [
  'schedule',
  'announcements',
  'discussions',
  'dashboard',
  'networking',
  'profile',
  'badge',
  'ai-guide',
];

/**
 * Les six roles livres avec l'application.
 *
 * Ils servent de point de depart a tout nouvel evenement, et de filet quand la
 * configuration ne declare rien : un evenement deja en cours continue donc de
 * fonctionner exactement comme avant.
 */
export const DEFAULT_ROLES: EventRole[] = [
  {
    id: 'super-admin',
    label: 'Super-Admin',
    dashboardLabel: 'Super-Admin & Paramètres',
    dashboard: 'admin',
    accent: 'rouge',
    builtIn: true,
    tabs: ALL_TABS,
    canScan: true,
    canBroadcast: true,
    canManageContent: true,
    canManageRoles: true,
    canManageIntegrations: true,
    canExport: true,
    canSeeAllFeedback: true,
    canImportData: true,
  },
  {
    id: 'organizer',
    label: 'Organisateur',
    dashboardLabel: 'Espace Organisateur',
    dashboard: 'organizer',
    accent: 'ambre',
    builtIn: true,
    tabs: ALL_TABS,
    canScan: true,
    canBroadcast: true,
    canManageContent: true,
    canManageRoles: false,
    canManageIntegrations: true,
    canExport: true,
    canSeeAllFeedback: true,
    canImportData: true,
  },
  {
    id: 'speaker',
    label: 'Conférencier',
    dashboardLabel: 'Espace Conférencier',
    dashboard: 'speaker',
    accent: 'indigo',
    builtIn: true,
    tabs: ALL_TABS,
    canScan: false,
    canBroadcast: false,
    canManageContent: false,
    canManageRoles: false,
    canManageIntegrations: false,
    canExport: false,
    canSeeAllFeedback: false,
    canImportData: false,
  },
  {
    id: 'volunteer',
    label: 'Volontaire',
    dashboardLabel: 'Espace Volontaire',
    dashboard: 'volunteer',
    accent: 'emeraude',
    builtIn: true,
    tabs: ['schedule', 'announcements', 'discussions', 'dashboard', 'profile', 'badge', 'ai-guide'],
    canScan: true,
    canBroadcast: false,
    canManageContent: false,
    canManageRoles: false,
    canManageIntegrations: false,
    canExport: false,
    canSeeAllFeedback: false,
    canImportData: false,
  },
  {
    id: 'attendee',
    label: 'Participant',
    dashboardLabel: 'Mon Espace',
    dashboard: 'attendee',
    accent: 'ardoise',
    builtIn: true,
    tabs: ALL_TABS,
    canScan: false,
    canBroadcast: false,
    canManageContent: false,
    canManageRoles: false,
    canManageIntegrations: false,
    canExport: false,
    canSeeAllFeedback: false,
    canImportData: false,
  },
  {
    id: 'sponsor',
    label: 'Sponsor / Partenaire',
    dashboardLabel: 'Espace Partenaire',
    dashboard: 'attendee',
    accent: 'violet',
    builtIn: true,
    tabs: ['schedule', 'announcements', 'discussions', 'dashboard', 'networking', 'profile', 'badge'],
    canScan: false,
    canBroadcast: false,
    canManageContent: false,
    canManageRoles: false,
    canManageIntegrations: false,
    canExport: false,
    canSeeAllFeedback: false,
    canImportData: false,
  },
];

/** Identifiants des roles fournis, pour les distinguer de ceux qu'on cree. */
export const BUILT_IN_ROLE_IDS: BuiltInRole[] = [
  'attendee',
  'speaker',
  'organizer',
  'volunteer',
  'sponsor',
  'super-admin',
];

/** Le role applique a qui n'en a pas, ou dont le role a ete supprime. */
export const FALLBACK_ROLE_ID = 'attendee';

/**
 * Table des roles en vigueur.
 *
 * Le module la garde parce que `capabilitiesFor` est appelee partout, y compris
 * dans des composants qui n'ont pas acces au contexte. Le serveur la remplit
 * depuis la configuration de l'evenement au demarrage ; le navigateur la
 * remplit a la reception de cette meme configuration. Les deux copies viennent
 * donc de la meme source, mais seule celle du serveur fait autorite.
 */
let activeRoles: EventRole[] = DEFAULT_ROLES;

/**
 * Installe les roles de l'evenement.
 *
 * Une liste vide est ignoree plutot qu'appliquee : perdre la table des roles
 * priverait tout le monde de ses droits, y compris de quoi la retablir.
 */
export function setActiveRoles(roles: EventRole[] | undefined | null): EventRole[] {
  activeRoles = roles && roles.length > 0 ? roles : DEFAULT_ROLES;
  return activeRoles;
}

export function getActiveRoles(): EventRole[] {
  return activeRoles;
}

/**
 * Droits d'un role.
 *
 * Un role inconnu — supprime depuis, ou mal orthographie dans le classeur —
 * retombe sur le role le plus restreint plutot que d'echouer : mieux vaut un
 * participant qui voit trop peu qu'un compte sans aucun droit, ou pire, un
 * appel qui leve au milieu d'une verification d'autorisation.
 */
export function capabilitiesFor(
  role: ParticipantRole,
  roles: EventRole[] = activeRoles,
): RoleCapabilities {
  const trouve = roles.find(item => item.id === role);
  if (trouve) return trouve;

  const repli = roles.find(item => item.id === FALLBACK_ROLE_ID);
  if (repli) return repli;

  return DEFAULT_ROLES[DEFAULT_ROLES.length - 2];
}

/** Definition complete d'un role, y compris son espace et sa teinte. */
export function roleFor(
  role: ParticipantRole,
  roles: EventRole[] = activeRoles,
): EventRole {
  return (
    roles.find(item => item.id === role) ||
    roles.find(item => item.id === FALLBACK_ROLE_ID) ||
    DEFAULT_ROLES[DEFAULT_ROLES.length - 2]
  );
}

export function canAccessTab(
  role: ParticipantRole,
  tab: string,
  roles: EventRole[] = activeRoles,
): boolean {
  return capabilitiesFor(role, roles).tabs.includes(tab as AppTab);
}

/** Libelle court d'un role, pour les badges et les listes deroulantes. */
export function labelForRole(
  role: ParticipantRole,
  roles: EventRole[] = activeRoles,
): string {
  return capabilitiesFor(role, roles).label;
}

/** Roles qu'un organisateur peut attribuer a un compte. */
export function assignableRoles(roles: EventRole[] = activeRoles): ParticipantRole[] {
  return roles.map(item => item.id);
}

/**
 * Mots employes par defaut : ceux d'une conference, puisque c'est ce que
 * l'application servait jusqu'ici.
 */
export const DEFAULT_TERMINOLOGY: EventTerminology = {
  session: 'session',
  sessions: 'sessions',
  checkIn: 'émargement',
  checkIns: 'émargements',
  schedule: 'programme',
  room: 'salle',
  rooms: 'salles',
  track: 'thématique',
  tracks: 'thématiques',
  badge: 'badge',
  feedback: 'avis',
  feedbacks: 'avis',
};

/** Met une majuscule initiale, sans toucher au reste du mot. */
export function capitaliser(mot: string): string {
  return mot ? mot.charAt(0).toUpperCase() + mot.slice(1) : mot;
}
