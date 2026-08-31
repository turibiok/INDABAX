import { ParticipantRole } from './types';

/** Onglets de navigation de l'application. */
export type AppTab =
  | 'schedule'
  | 'announcements'
  | 'discussions'
  | 'dashboard'
  | 'networking'
  | 'badge'
  | 'ai-guide';

export interface RoleCapabilities {
  /** Libelle du role affiche dans l'interface. */
  label: string;
  /** Libelle de l'onglet "Mon Espace" pour ce role. */
  dashboardLabel: string;
  /** Onglets visibles pour ce role. */
  tabs: AppTab[];
  /** Peut scanner les QR codes et valider les presences. */
  canScan: boolean;
  /** Peut publier des annonces a tout l'evenement. */
  canBroadcast: boolean;
  /** Peut creer / modifier / supprimer sessions, participants, annonces. */
  canManageContent: boolean;
  /** Peut attribuer les roles aux emails (Super-Admin uniquement). */
  canManageRoles: boolean;
  /** Peut lier le classeur Google Sheet et lancer les synchronisations. */
  canManageIntegrations: boolean;
  /** Peut exporter les donnees (CSV / JSON). */
  canExport: boolean;
  /** Peut consulter tous les feedbacks, pas seulement les siens. */
  canSeeAllFeedback: boolean;
  /** Peut importer des donnees en masse. */
  canImportData: boolean;
}

const ALL_TABS: AppTab[] = [
  'schedule',
  'announcements',
  'discussions',
  'dashboard',
  'networking',
  'badge',
  'ai-guide',
];

export const ROLE_CAPABILITIES: Record<ParticipantRole, RoleCapabilities> = {
  'super-admin': {
    label: 'Super-Admin',
    dashboardLabel: 'Super-Admin & Paramètres',
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
  organizer: {
    label: 'Organisateur',
    dashboardLabel: 'Espace Organisateur',
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
  speaker: {
    label: 'Conférencier',
    dashboardLabel: 'Espace Conférencier',
    tabs: ['schedule', 'announcements', 'discussions', 'dashboard', 'networking', 'badge', 'ai-guide'],
    canScan: false,
    canBroadcast: false,
    canManageContent: false,
    canManageRoles: false,
    canManageIntegrations: false,
    canExport: false,
    canSeeAllFeedback: false,
    canImportData: false,
  },
  volunteer: {
    label: 'Volontaire',
    dashboardLabel: 'Espace Volontaire',
    tabs: ['schedule', 'announcements', 'discussions', 'dashboard', 'badge', 'ai-guide'],
    canScan: true,
    canBroadcast: false,
    canManageContent: false,
    canManageRoles: false,
    canManageIntegrations: false,
    canExport: false,
    canSeeAllFeedback: false,
    canImportData: false,
  },
  attendee: {
    label: 'Participant',
    dashboardLabel: 'Mon Espace',
    tabs: ['schedule', 'announcements', 'discussions', 'dashboard', 'networking', 'badge', 'ai-guide'],
    canScan: false,
    canBroadcast: false,
    canManageContent: false,
    canManageRoles: false,
    canManageIntegrations: false,
    canExport: false,
    canSeeAllFeedback: false,
    canImportData: false,
  },
  sponsor: {
    label: 'Sponsor / Partenaire',
    dashboardLabel: 'Espace Partenaire',
    tabs: ['schedule', 'announcements', 'discussions', 'dashboard', 'networking', 'badge'],
    canScan: false,
    canBroadcast: false,
    canManageContent: false,
    canManageRoles: false,
    canManageIntegrations: false,
    canExport: false,
    canSeeAllFeedback: false,
    canImportData: false,
  },
};

export function capabilitiesFor(role: ParticipantRole): RoleCapabilities {
  return ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.attendee;
}

export function canAccessTab(role: ParticipantRole, tab: string): boolean {
  return capabilitiesFor(role).tabs.includes(tab as AppTab);
}

/** Libelles courts utilises dans les badges et listes deroulantes. */
export const ROLE_LABELS: Record<ParticipantRole, string> = {
  'super-admin': 'Super-Admin',
  organizer: 'Organisateur',
  speaker: 'Conférencier',
  volunteer: 'Volontaire',
  attendee: 'Participant',
  sponsor: 'Sponsor',
};

export const ASSIGNABLE_ROLES: ParticipantRole[] = [
  'attendee',
  'speaker',
  'volunteer',
  'organizer',
  'sponsor',
  'super-admin',
];
