/**
 * Configuration de l'evenement : identite, vocabulaire, apparence et roles.
 *
 * Elle vivait dans le `localStorage` du navigateur, ce qui la rendait invisible
 * a tout le monde sauf a celui qui la modifiait. Elle vit maintenant dans le
 * classeur, comme le reste : les organisateurs peuvent la corriger a la main,
 * elle survit a une remise a zero du disque, et c'est le serveur qui la sert a
 * tous.
 *
 * Le serveur en garde une copie en memoire parce que l'ecran de connexion la
 * demande avant toute session : aller lire le classeur a chaque affichage
 * couterait une seconde a chaque visiteur.
 */

import {
  DEFAULT_ROLES,
  DEFAULT_TERMINOLOGY,
  FALLBACK_ROLE_ID,
  setActiveRoles,
} from '../src/permissions';
import {
  AppTab,
  DashboardKind,
  DocLink,
  EventBranding,
  EventRole,
  EventTerminology,
  RoleAccent,
  RoomConfig,
} from '../src/types';
import { readTab, SheetError, writeRows } from './sheetsGateway';
import { getSheetsConfig } from './store';

/** Identite de l'evenement, telle que l'application l'affiche. */
export interface EventIdentity {
  eventName: string;
  edition: string;
  startDate: string;
  endDate: string;
  location: string;
  venueAddress: string;
  themeDescription: string;
  contactEmail: string;
  websiteUrl: string;
  twitterHandle: string;
  linkedinUrl: string;
  /**
   * Prefixe des numeros de billet, par exemple « INDABAX-BJ-2026 ».
   *
   * Configurable et non deduit du nom : les billets deja distribues portent un
   * prefixe qu'il faut pouvoir conserver a l'identique, faute de quoi deux
   * personnes du meme evenement auraient des billets de formes differentes.
   * Laisse vide, il est fabrique a partir du nom de l'evenement.
   */
  ticketPrefix: string;
  /**
   * Adresse d'expedition des emails de l'application.
   *
   * Vide, les mails partent du compte Google proprietaire du Apps Script.
   * Renseignee, cette adresse doit etre verifiee sur ce meme compte — soit
   * qu'elle lui appartienne, soit qu'elle y figure comme alias d'envoi.
   */
  senderEmail: string;
  /** Nom affiche a cote de l'adresse d'expedition. Vide : le nom de l'evenement. */
  senderName: string;
}

/**
 * Reglages de fonctionnement.
 *
 * Ils changent ce que l'application autorise, pas ce qu'elle affiche : ils
 * meritaient donc d'etre distingues de l'identite.
 */
export interface EventSettings {
  allowExpressRegistration: boolean;
  maintenanceMode: boolean;
  enableAnonymousFeedback: boolean;
  autoSyncGoogleSheets: boolean;
  sessionReminderMinutes: number;
}

/** Listes attachees a l'evenement : salles, thematiques, documents publies. */
export interface EventCollections {
  rooms: RoomConfig[];
  tracks: string[];
  docLinks: DocLink[];
}

export interface ServerEventConfig {
  identity: EventIdentity;
  settings: EventSettings;
  collections: EventCollections;
  terminology: EventTerminology;
  branding: EventBranding;
  roles: EventRole[];
  /** Vrai quand la configuration vient du classeur et non des valeurs livrees. */
  fromSheet: boolean;
  /** Instant de la derniere lecture reussie du classeur. */
  loadedAt: number;
}

const ONGLET_CONFIG = 'Configuration';
const ONGLET_ROLES = 'Rôles';

/**
 * Identite par defaut.
 *
 * Volontairement neutre : une installation neuve ne doit pas se presenter comme
 * un evenement qui ne lui appartient pas. IndabaX Benin garde la sienne parce
 * qu'elle est ecrite dans son propre classeur.
 */
const IDENTITE_PAR_DEFAUT: EventIdentity = {
  eventName: 'Mon événement',
  edition: String(new Date().getFullYear()),
  startDate: '',
  endDate: '',
  location: '',
  venueAddress: '',
  themeDescription: '',
  contactEmail: '',
  websiteUrl: '',
  twitterHandle: '',
  linkedinUrl: '',
  ticketPrefix: '',
  senderEmail: '',
  senderName: '',
};

const REGLAGES_PAR_DEFAUT: EventSettings = {
  allowExpressRegistration: true,
  maintenanceMode: false,
  enableAnonymousFeedback: true,
  autoSyncGoogleSheets: true,
  sessionReminderMinutes: 15,
};

const LISTES_PAR_DEFAUT: EventCollections = { rooms: [], tracks: [], docLinks: [] };

const APPARENCE_PAR_DEFAUT: EventBranding = {
  logoUrl: '',
  logoDarkUrl: '',
  primaryColor: '#047857',
  accentColor: '#d97706',
};

const TOUS_LES_ONGLETS: AppTab[] = [
  'schedule',
  'announcements',
  'discussions',
  'dashboard',
  'networking',
  'profile',
  'badge',
  'ai-guide',
];

const ESPACES: DashboardKind[] = ['admin', 'organizer', 'speaker', 'volunteer', 'attendee'];

const TEINTES: RoleAccent[] = [
  'rouge',
  'ambre',
  'indigo',
  'emeraude',
  'violet',
  'ardoise',
  'ciel',
  'rose',
];

let courante: ServerEventConfig = {
  identity: { ...IDENTITE_PAR_DEFAUT },
  settings: { ...REGLAGES_PAR_DEFAUT },
  collections: { ...LISTES_PAR_DEFAUT },
  terminology: { ...DEFAULT_TERMINOLOGY },
  branding: { ...APPARENCE_PAR_DEFAUT },
  roles: DEFAULT_ROLES,
  fromSheet: false,
  loadedAt: 0,
};

/* ------------------------------------------------------------------ *
 * Lecture tolerante
 * ------------------------------------------------------------------ */

/** Compare deux libelles sans tenir compte des accents, de la casse ni des espaces. */
function normaliser(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Lit une colonne quel que soit le libelle exact employe dans le classeur. */
function colonne(ligne: Record<string, string>, ...noms: string[]): string {
  for (const nom of noms) {
    const cible = normaliser(nom);
    for (const [cle, valeur] of Object.entries(ligne)) {
      if (normaliser(cle) === cible) return (valeur || '').trim();
    }
  }
  return '';
}

/**
 * Interprete un oui / non.
 *
 * Un droit absent vaut « non » : une case laissee vide ne doit jamais accorder
 * un pouvoir que personne n'a voulu donner.
 */
function versBooleen(valeur: string): boolean {
  const v = normaliser(valeur);
  return v === 'oui' || v === 'vrai' || v === 'true' || v === 'yes' || v === '1' || v === 'x';
}

function versTexte(valeur: string): string {
  return versBooleen(valeur) ? 'oui' : 'non';
}

/** Interprete la liste d'onglets d'un role. */
function versOnglets(valeur: string): AppTab[] {
  const brut = (valeur || '').trim();
  if (!brut || normaliser(brut) === 'tous' || normaliser(brut) === 'all') return [...TOUS_LES_ONGLETS];

  const demandes = brut
    .split(/[,;]/)
    .map(item => normaliser(item))
    .filter(Boolean);

  const retenus = TOUS_LES_ONGLETS.filter(onglet => demandes.includes(normaliser(onglet)));

  // Aucun onglet reconnu : on rend l'acces minimal plutot qu'une interface
  // vide, ou la personne ne pourrait meme pas consulter son propre profil.
  return retenus.length > 0 ? retenus : ['profile'];
}

function versEspace(valeur: string): DashboardKind {
  const v = normaliser(valeur);
  return ESPACES.find(espace => normaliser(espace) === v) || 'attendee';
}

function versTeinte(valeur: string): RoleAccent {
  const v = normaliser(valeur);
  return TEINTES.find(teinte => normaliser(teinte) === v) || 'ardoise';
}

/* ------------------------------------------------------------------ *
 * Roles
 * ------------------------------------------------------------------ */

/**
 * Construit la table des roles a partir de l'onglet.
 *
 * Trois garde-fous, tous appris a la lecture de ce que peut contenir une
 * feuille remplie a la main :
 *
 * - les six roles livres sont toujours presents, meme absents de la feuille,
 *   sans quoi un compte existant perdrait son role ;
 * - un role sans identifiant est ignore, car il ne pourrait etre attribue ;
 * - si personne ne peut plus gerer les roles, on refuse la table entiere :
 *   l'evenement se retrouverait sans moyen de se corriger.
 */
export function rolesDepuisLignes(lignes: Record<string, string>[]): {
  roles: EventRole[];
  avertissements: string[];
} {
  const avertissements: string[] = [];
  const parId = new Map<string, EventRole>();

  for (const fourni of DEFAULT_ROLES) parId.set(fourni.id, { ...fourni });

  for (const ligne of lignes) {
    const id = colonne(ligne, 'ID', 'identifiant', 'role', 'code').trim();
    if (!id) continue;

    const libelle = colonne(ligne, 'Libellé', 'libelle', 'nom', 'label');
    const fourni = DEFAULT_ROLES.find(item => item.id === id);

    if (!libelle && !fourni) {
      avertissements.push(`Rôle « ${id} » ignoré : il lui faut un libellé.`);
      continue;
    }

    parId.set(id, {
      id,
      label: libelle || fourni?.label || id,
      dashboardLabel:
        colonne(ligne, 'Titre espace', 'dashboardLabel') ||
        fourni?.dashboardLabel ||
        `Espace ${libelle || id}`,
      dashboard: versEspace(colonne(ligne, 'Espace', 'dashboard')),
      accent: versTeinte(colonne(ligne, 'Teinte', 'couleur', 'accent')),
      tabs: versOnglets(colonne(ligne, 'Onglets', 'tabs')),
      canScan: versBooleen(colonne(ligne, 'Scanner', 'canScan')),
      canBroadcast: versBooleen(colonne(ligne, 'Diffuser', 'canBroadcast')),
      canManageContent: versBooleen(colonne(ligne, 'Gérer contenu', 'canManageContent')),
      canManageRoles: versBooleen(colonne(ligne, 'Gérer rôles', 'canManageRoles')),
      canManageIntegrations: versBooleen(
        colonne(ligne, 'Gérer intégrations', 'canManageIntegrations'),
      ),
      canExport: versBooleen(colonne(ligne, 'Exporter', 'canExport')),
      canSeeAllFeedback: versBooleen(colonne(ligne, 'Voir tous les avis', 'canSeeAllFeedback')),
      canImportData: versBooleen(colonne(ligne, 'Importer', 'canImportData')),
      builtIn: Boolean(fourni),
    });
  }

  const roles = [...parId.values()];

  if (!roles.some(role => role.canManageRoles)) {
    avertissements.push(
      "Aucun rôle ne pouvait plus gérer les rôles : la feuille a été ignorée, " +
        'les rôles livrés restent en vigueur.',
    );
    return { roles: DEFAULT_ROLES, avertissements };
  }

  if (!roles.some(role => role.id === FALLBACK_ROLE_ID)) {
    avertissements.push(
      `Le rôle « ${FALLBACK_ROLE_ID} » a été rétabli : il sert de repli aux comptes sans rôle connu.`,
    );
  }

  return { roles, avertissements };
}

/** Transforme la table des roles en lignes pour le classeur. */
export function rolesVersLignes(roles: EventRole[]): Record<string, string>[] {
  return roles.map(role => ({
    ID: role.id,
    'Libellé': role.label,
    'Titre espace': role.dashboardLabel,
    Espace: role.dashboard,
    Teinte: role.accent,
    Onglets: role.tabs.length === TOUS_LES_ONGLETS.length ? 'tous' : role.tabs.join(', '),
    Scanner: versTexte(String(role.canScan)),
    Diffuser: versTexte(String(role.canBroadcast)),
    'Gérer contenu': versTexte(String(role.canManageContent)),
    'Gérer rôles': versTexte(String(role.canManageRoles)),
    'Gérer intégrations': versTexte(String(role.canManageIntegrations)),
    Exporter: versTexte(String(role.canExport)),
    'Voir tous les avis': versTexte(String(role.canSeeAllFeedback)),
    Importer: versTexte(String(role.canImportData)),
  }));
}

/* ------------------------------------------------------------------ *
 * Identite, vocabulaire, apparence
 * ------------------------------------------------------------------ */

/** Cles reconnues dans l'onglet Configuration, et ou elles atterrissent. */
const CLES_IDENTITE: (keyof EventIdentity)[] = [
  'eventName',
  'edition',
  'startDate',
  'endDate',
  'location',
  'venueAddress',
  'themeDescription',
  'contactEmail',
  'websiteUrl',
  'twitterHandle',
  'linkedinUrl',
  'ticketPrefix',
  'senderEmail',
  'senderName',
];

const CLES_APPARENCE: (keyof EventBranding)[] = [
  'logoUrl',
  'logoDarkUrl',
  'primaryColor',
  'accentColor',
];

/** Reglages booleens, et leur cle dans la feuille. */
const CLES_REGLAGES_BOOLEENS: (keyof EventSettings)[] = [
  'allowExpressRegistration',
  'maintenanceMode',
  'enableAnonymousFeedback',
  'autoSyncGoogleSheets',
];

/** Listes ecrites en JSON, faute de pouvoir tenir sur une cellule autrement. */
const CLES_LISTES: (keyof EventCollections)[] = ['rooms', 'tracks', 'docLinks'];

/**
 * Lit une liste ecrite en JSON.
 *
 * Une cellule illisible laisse la liste precedente plutot que de la vider : une
 * accolade oubliee dans le classeur ne doit pas faire disparaitre toutes les
 * salles de l'evenement.
 */
function versListe<T>(valeur: string, repli: T[]): T[] {
  const brut = (valeur || '').trim();
  if (!brut) return repli;

  try {
    const lu = JSON.parse(brut);
    return Array.isArray(lu) ? (lu as T[]) : repli;
  } catch {
    return repli;
  }
}

/** Construit identite, vocabulaire et apparence depuis les lignes clé / valeur. */
export function configDepuisLignes(lignes: Record<string, string>[]): {
  identity: EventIdentity;
  settings: EventSettings;
  collections: EventCollections;
  terminology: EventTerminology;
  branding: EventBranding;
} {
  const valeurs = new Map<string, string>();

  for (const ligne of lignes) {
    const cle = colonne(ligne, 'Clé', 'cle', 'key', 'paramètre', 'parametre');
    if (!cle) continue;
    valeurs.set(normaliser(cle), colonne(ligne, 'Valeur', 'value', 'contenu'));
  }

  const lire = (cle: string): string => valeurs.get(normaliser(cle)) || '';

  const identity = { ...IDENTITE_PAR_DEFAUT };
  for (const cle of CLES_IDENTITE) {
    const valeur = lire(cle);
    if (valeur) identity[cle] = valeur;
  }

  const branding = { ...APPARENCE_PAR_DEFAUT };
  for (const cle of CLES_APPARENCE) {
    const valeur = lire(cle);
    if (valeur) branding[cle] = valeur;
  }

  const terminology = { ...DEFAULT_TERMINOLOGY };
  for (const mot of Object.keys(DEFAULT_TERMINOLOGY) as (keyof EventTerminology)[]) {
    const valeur = lire(`term.${mot}`);
    if (valeur) terminology[mot] = valeur;
  }

  const settings = { ...REGLAGES_PAR_DEFAUT };
  for (const cle of CLES_REGLAGES_BOOLEENS) {
    const valeur = lire(cle);
    if (valeur) (settings[cle] as boolean) = versBooleen(valeur);
  }

  const minutes = Number(lire('sessionReminderMinutes'));
  if (Number.isFinite(minutes) && minutes >= 0) settings.sessionReminderMinutes = minutes;

  const collections = { ...LISTES_PAR_DEFAUT };
  for (const cle of CLES_LISTES) {
    (collections[cle] as unknown[]) = versListe(lire(cle), LISTES_PAR_DEFAUT[cle] as unknown[]);
  }

  return { identity, settings, collections, terminology, branding };
}

/** Transforme identite, vocabulaire et apparence en lignes clé / valeur. */
export function configVersLignes(config: {
  identity: EventIdentity;
  settings: EventSettings;
  collections: EventCollections;
  terminology: EventTerminology;
  branding: EventBranding;
}): Record<string, string>[] {
  const lignes: Record<string, string>[] = [];

  for (const cle of CLES_IDENTITE) {
    lignes.push({ 'Clé': cle, Valeur: config.identity[cle] || '' });
  }
  for (const cle of CLES_APPARENCE) {
    lignes.push({ 'Clé': cle, Valeur: config.branding[cle] || '' });
  }
  for (const mot of Object.keys(config.terminology) as (keyof EventTerminology)[]) {
    lignes.push({ 'Clé': `term.${mot}`, Valeur: config.terminology[mot] || '' });
  }

  for (const cle of CLES_REGLAGES_BOOLEENS) {
    lignes.push({ 'Clé': cle, Valeur: config.settings[cle] ? 'oui' : 'non' });
  }
  lignes.push({
    'Clé': 'sessionReminderMinutes',
    Valeur: String(config.settings.sessionReminderMinutes),
  });

  for (const cle of CLES_LISTES) {
    lignes.push({ 'Clé': cle, Valeur: JSON.stringify(config.collections[cle] || []) });
  }

  return lignes;
}

/* ------------------------------------------------------------------ *
 * Chargement et enregistrement
 * ------------------------------------------------------------------ */

/**
 * Relit la configuration depuis le classeur.
 *
 * Les deux onglets sont facultatifs : un classeur qui n'en a aucun continue de
 * fonctionner avec les valeurs livrees, ce qui evite d'imposer une migration a
 * un evenement deja en cours.
 */
export async function reloadEventConfig(): Promise<{
  config: ServerEventConfig;
  avertissements: string[];
}> {
  const avertissements: string[] = [];
  const sheets = getSheetsConfig();

  if (!sheets.masterSheetUrl.trim()) {
    appliquer(courante);
    return { config: courante, avertissements };
  }

  let identity = { ...IDENTITE_PAR_DEFAUT };
  let settings = { ...REGLAGES_PAR_DEFAUT };
  let collections = { ...LISTES_PAR_DEFAUT };
  let terminology = { ...DEFAULT_TERMINOLOGY };
  let branding = { ...APPARENCE_PAR_DEFAUT };
  let roles = DEFAULT_ROLES;
  let trouve = false;

  try {
    const table = await readTab(ONGLET_CONFIG, sheets, ['Clé', 'Valeur'], { strictName: true });
    const lu = configDepuisLignes(table.rows);
    identity = lu.identity;
    settings = lu.settings;
    collections = lu.collections;
    terminology = lu.terminology;
    branding = lu.branding;
    trouve = true;
  } catch (error) {
    if (!estOngletAbsent(error)) {
      avertissements.push(`Onglet « ${ONGLET_CONFIG} » illisible : ${messageDe(error)}`);
    }
  }

  try {
    const table = await readTab(ONGLET_ROLES, sheets, ['ID', 'Libellé'], { strictName: true });
    const lu = rolesDepuisLignes(table.rows);
    roles = lu.roles;
    avertissements.push(...lu.avertissements);
    trouve = true;
  } catch (error) {
    if (!estOngletAbsent(error)) {
      avertissements.push(`Onglet « ${ONGLET_ROLES} » illisible : ${messageDe(error)}`);
    }
  }

  courante = {
    identity,
    settings,
    collections,
    terminology,
    branding,
    roles,
    fromSheet: trouve,
    loadedAt: Date.now(),
  };

  appliquer(courante);
  return { config: courante, avertissements };
}

/** Installe la table des roles pour que `capabilitiesFor` la consulte. */
function appliquer(config: ServerEventConfig): void {
  setActiveRoles(config.roles);
}

/**
 * Distingue « cet onglet n'existe pas » de « le classeur est en panne ».
 *
 * Les deux onglets sont facultatifs : leur absence est normale et doit rester
 * muette, alors qu'un classeur injoignable merite d'etre signale.
 */
function estOngletAbsent(error: unknown): boolean {
  return (
    error instanceof SheetError && (error.reason === 'tab_not_found' || error.status === 404)
  );
}

function messageDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getEventConfig(): ServerEventConfig {
  return courante;
}

/** Enregistre l'identite, le vocabulaire et l'apparence dans le classeur. */
export async function saveEventConfig(patch: {
  identity?: Partial<EventIdentity>;
  settings?: Partial<EventSettings>;
  collections?: Partial<EventCollections>;
  terminology?: Partial<EventTerminology>;
  branding?: Partial<EventBranding>;
}): Promise<ServerEventConfig> {
  const fusionne = {
    identity: { ...courante.identity, ...(patch.identity || {}) },
    settings: { ...courante.settings, ...(patch.settings || {}) },
    collections: { ...courante.collections, ...(patch.collections || {}) },
    terminology: { ...courante.terminology, ...(patch.terminology || {}) },
    branding: { ...courante.branding, ...(patch.branding || {}) },
  };

  await writeRows(ONGLET_CONFIG, configVersLignes(fusionne), { keyColumn: 'Clé' });

  courante = { ...courante, ...fusionne, fromSheet: true, loadedAt: Date.now() };
  appliquer(courante);
  return courante;
}

/**
 * Enregistre la table des roles.
 *
 * Elle repasse par `rolesDepuisLignes` avant d'etre ecrite : ce que le serveur
 * retient est donc exactement ce qu'il relirait du classeur, garde-fous
 * compris. Une table refusee par ces garde-fous n'est pas ecrite.
 */
export async function saveRoles(roles: EventRole[]): Promise<{
  config: ServerEventConfig;
  avertissements: string[];
}> {
  const { roles: valides, avertissements } = rolesDepuisLignes(rolesVersLignes(roles));

  await writeRows(ONGLET_ROLES, rolesVersLignes(valides), { keyColumn: 'ID' });

  courante = { ...courante, roles: valides, fromSheet: true, loadedAt: Date.now() };
  appliquer(courante);
  return { config: courante, avertissements };
}
