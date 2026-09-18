/**
 * Registre de la plateforme Tech Event.
 *
 * L'application servait un evenement ; elle en sert maintenant plusieurs, et il
 * faut bien que quelque chose sache lesquels existent et a qui ils sont.
 *
 * Ce registre vit dans un classeur a part — celui de la plateforme — et non
 * dans l'un des classeurs d'evenement : un organisateur ne doit jamais pouvoir
 * lire la liste des autres, ni toucher a leurs comptes. C'est aussi pourquoi
 * les donnees de chaque evenement restent dans SON classeur : deux evenements
 * ne partagent aucune ligne, donc aucune requete mal filtree ne peut faire
 * fuiter l'annuaire de l'un vers l'autre.
 */

import { randomUUID } from 'crypto';

import { readTab, SheetError, writeRows } from './sheetsGateway';
import { ServerSheetsConfig } from './store';

/* ------------------------------------------------------------------ *
 * Modele
 * ------------------------------------------------------------------ */

/**
 * Ce qu'une personne peut faire sur la plateforme elle-meme.
 *
 * A ne pas confondre avec son role DANS un evenement : quelqu'un peut etre
 * organisateur de son propre evenement et simple participant a un autre.
 */
export type PlatformRole = 'admin' | 'organizer' | 'member';

/** Etat de publication d'un evenement. */
export type EventStatus = 'draft' | 'published' | 'archived';

export interface PlatformAccount {
  email: string;
  name: string;
  role: PlatformRole;
  /** Empreinte scrypt. Jamais renvoyee au navigateur. */
  passwordHash?: string;
  createdAt: string;
  /** Compte suspendu : il ne peut plus rien creer ni modifier. */
  suspended?: boolean;
}

/** Un evenement inscrit au registre. */
export interface EventRecord {
  /** Identifiant lisible, employe dans les URL : « indabax-benin-2026 ». */
  slug: string;
  name: string;
  edition: string;
  startDate: string;
  endDate: string;
  location: string;
  /** Une phrase de presentation, affichee sur la vitrine. */
  summary: string;
  /** Email du compte qui l'a cree et qui en repond. */
  ownerEmail: string;
  status: EventStatus;
  /** Classeur Google qui porte les donnees de CET evenement. */
  sheetUrl: string;
  /** Apps Script deploye sur ce classeur, pour y ecrire. */
  appsScriptUrl: string;
  /** Logo carre, pour les listes et la barre de navigation. */
  logoUrl: string;
  /** Affiche, au format portrait, mise en avant sur la vitrine. */
  posterUrl: string;
  primaryColor: string;
  createdAt: string;
  updatedAt: string;
}

const ONGLET_EVENEMENTS = 'Événements';
const ONGLET_COMPTES = 'Comptes plateforme';

/* ------------------------------------------------------------------ *
 * Lecture tolerante
 * ------------------------------------------------------------------ */

function normaliser(valeur: string): string {
  return (valeur || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

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
 * Fabrique un identifiant d'URL a partir d'un nom.
 *
 * Volontairement restreint aux lettres sans accent, aux chiffres et au tiret :
 * cet identifiant se retrouve dans des liens qu'on recopie a la main et qu'on
 * dicte au telephone.
 */
export function versSlug(valeur: string): string {
  return (valeur || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function versStatut(valeur: string): EventStatus {
  const v = normaliser(valeur);
  if (v === 'published' || v === 'publie' || v === 'enligne') return 'published';
  if (v === 'archived' || v === 'archive') return 'archived';
  return 'draft';
}

function versRole(valeur: string): PlatformRole {
  const v = normaliser(valeur);
  if (v === 'admin' || v === 'administrateur') return 'admin';
  if (v === 'organizer' || v === 'organisateur') return 'organizer';
  return 'member';
}

function versBooleen(valeur: string): boolean {
  const v = normaliser(valeur);
  return v === 'oui' || v === 'vrai' || v === 'true' || v === '1' || v === 'x';
}

/* ------------------------------------------------------------------ *
 * Etat en memoire
 * ------------------------------------------------------------------ */

interface EtatPlateforme {
  events: EventRecord[];
  accounts: PlatformAccount[];
  /** Vrai quand le registre a ete lu dans son classeur. */
  loaded: boolean;
  loadedAt: number;
  /** Ce qui a empeche la derniere lecture, s'il y a lieu. */
  lastError?: string;
}

let etat: EtatPlateforme = { events: [], accounts: [], loaded: false, loadedAt: 0 };

/** Configuration du classeur de la plateforme, distincte de celle d'un evenement. */
function configRegistre(): ServerSheetsConfig | undefined {
  const url = (process.env.PLATFORM_SHEET_URL || '').trim();
  const script = (process.env.PLATFORM_APPS_SCRIPT_URL || '').trim();
  if (!url) return undefined;

  return {
    masterSheetUrl: url,
    writeWebhookUrl: script,
    profilesTab: ONGLET_COMPTES,
    sessionsTab: '',
    checkInsTab: '',
    feedbacksTab: '',
    announcementsTab: '',
    messagesTab: '',
    appSheetAppId: '',
    appSheetAccessKey: '',
    isLinked: true,
    autoSync: false,
  } as ServerSheetsConfig;
}

export function registreConfigure(): boolean {
  return Boolean(configRegistre());
}

/* ------------------------------------------------------------------ *
 * Conversion
 * ------------------------------------------------------------------ */

export function evenementDepuisLigne(ligne: Record<string, string>): EventRecord | null {
  const nom = colonne(ligne, 'Nom', 'name', 'événement', 'evenement');
  const slug = versSlug(colonne(ligne, 'Identifiant', 'slug', 'id') || nom);

  // Sans identifiant ni nom, la ligne ne designe aucun evenement joignable.
  if (!slug || !nom) return null;

  return {
    slug,
    name: nom,
    edition: colonne(ligne, 'Édition', 'edition'),
    startDate: colonne(ligne, 'Début', 'debut', 'startDate', 'date de début'),
    endDate: colonne(ligne, 'Fin', 'endDate', 'date de fin'),
    location: colonne(ligne, 'Lieu', 'location', 'ville'),
    summary: colonne(ligne, 'Résumé', 'resume', 'summary', 'description'),
    ownerEmail: colonne(ligne, 'Organisateur', 'ownerEmail', 'email', 'propriétaire').toLowerCase(),
    status: versStatut(colonne(ligne, 'Statut', 'status', 'état')),
    sheetUrl: colonne(ligne, 'Classeur', 'sheetUrl', 'lien classeur'),
    appsScriptUrl: colonne(ligne, 'Apps Script', 'appsScriptUrl', 'script'),
    logoUrl: colonne(ligne, 'Logo', 'logoUrl'),
    posterUrl: colonne(ligne, 'Affiche', 'posterUrl', 'poster', 'visuel'),
    primaryColor: colonne(ligne, 'Couleur', 'primaryColor') || '#047857',
    createdAt: colonne(ligne, 'Créé le', 'createdAt') || new Date().toISOString(),
    updatedAt: colonne(ligne, 'Modifié le', 'updatedAt') || new Date().toISOString(),
  };
}

export function evenementVersLigne(e: EventRecord): Record<string, string> {
  return {
    Identifiant: e.slug,
    Nom: e.name,
    'Édition': e.edition,
    'Début': e.startDate,
    Fin: e.endDate,
    Lieu: e.location,
    'Résumé': e.summary,
    Organisateur: e.ownerEmail,
    Statut: e.status,
    Classeur: e.sheetUrl,
    'Apps Script': e.appsScriptUrl,
    Logo: e.logoUrl,
    Affiche: e.posterUrl,
    Couleur: e.primaryColor,
    'Créé le': e.createdAt,
    'Modifié le': e.updatedAt,
  };
}

export function compteDepuisLigne(ligne: Record<string, string>): PlatformAccount | null {
  const email = colonne(ligne, 'Email', 'mail', 'courriel').toLowerCase();
  if (!email.includes('@')) return null;

  const secret = colonne(ligne, 'Empreinte', 'hash');

  return {
    email,
    name: colonne(ligne, 'Nom', 'name') || email.split('@')[0],
    role: versRole(colonne(ligne, 'Rôle', 'role')),
    // Seule une empreinte est acceptee ici. Un mot de passe en clair dans le
    // registre de la plateforme donnerait acces a tous les evenements a la
    // fois : il vaut mieux qu'un compte soit inutilisable que devinable.
    passwordHash: secret.startsWith('scrypt$') ? secret : undefined,
    createdAt: colonne(ligne, 'Créé le', 'createdAt') || new Date().toISOString(),
    suspended: versBooleen(colonne(ligne, 'Suspendu', 'suspended')),
  };
}

export function compteVersLigne(c: PlatformAccount): Record<string, string> {
  return {
    Email: c.email,
    Nom: c.name,
    'Rôle': c.role,
    Empreinte: c.passwordHash || '',
    'Créé le': c.createdAt,
    Suspendu: c.suspended ? 'oui' : 'non',
  };
}

/* ------------------------------------------------------------------ *
 * Chargement
 * ------------------------------------------------------------------ */

/** Relit le registre depuis son classeur. */
export async function chargerRegistre(): Promise<{ events: number; accounts: number; erreurs: string[] }> {
  const config = configRegistre();
  const erreurs: string[] = [];

  if (!config) {
    etat = { events: [], accounts: [], loaded: false, loadedAt: Date.now() };
    return { events: 0, accounts: 0, erreurs: ["PLATFORM_SHEET_URL n'est pas renseignée."] };
  }

  let events: EventRecord[] = [];
  let accounts: PlatformAccount[] = [];

  try {
    const table = await readTab(ONGLET_EVENEMENTS, config, ['Identifiant', 'Nom'], {
      strictName: true,
    });
    events = table.rows.map(evenementDepuisLigne).filter((e): e is EventRecord => e !== null);
  } catch (error) {
    erreurs.push(`Onglet « ${ONGLET_EVENEMENTS} » : ${messageDe(error)}`);
  }

  try {
    const table = await readTab(ONGLET_COMPTES, config, ['Email', 'Rôle'], { strictName: true });
    accounts = table.rows.map(compteDepuisLigne).filter((c): c is PlatformAccount => c !== null);
  } catch (error) {
    erreurs.push(`Onglet « ${ONGLET_COMPTES} » : ${messageDe(error)}`);
  }

  etat = {
    events,
    accounts,
    loaded: erreurs.length === 0,
    loadedAt: Date.now(),
    lastError: erreurs[0],
  };

  return { events: events.length, accounts: accounts.length, erreurs };
}

function messageDe(error: unknown): string {
  return error instanceof SheetError ? error.message : String((error as Error)?.message || error);
}

/* ------------------------------------------------------------------ *
 * Consultation
 * ------------------------------------------------------------------ */

export function tousLesEvenements(): EventRecord[] {
  return etat.events;
}

/** Les evenements visibles sans connexion : publies, et pas archives. */
export function evenementsPublics(): EventRecord[] {
  return etat.events.filter(e => e.status === 'published');
}

/** Les evenements dont cette personne repond. */
export function evenementsDe(email: string): EventRecord[] {
  const cible = (email || '').toLowerCase();
  return etat.events.filter(e => e.ownerEmail === cible);
}

export function evenementParSlug(slug: string): EventRecord | undefined {
  return etat.events.find(e => e.slug === slug);
}

export function comptePlateforme(email: string): PlatformAccount | undefined {
  const cible = (email || '').toLowerCase();
  return etat.accounts.find(c => c.email === cible);
}

export function tousLesComptes(): PlatformAccount[] {
  return etat.accounts;
}

export function etatRegistre(): { loaded: boolean; loadedAt: number; lastError?: string } {
  return { loaded: etat.loaded, loadedAt: etat.loadedAt, lastError: etat.lastError };
}

/* ------------------------------------------------------------------ *
 * Ecriture
 * ------------------------------------------------------------------ */

/** Genere un identifiant libre a partir d'un nom, sans ecraser un existant. */
export function slugDisponible(nom: string, edition: string): string {
  const base = versSlug([nom, edition].filter(Boolean).join(' ')) || `evenement-${randomUUID().slice(0, 6)}`;

  let slug = base;
  let n = 2;
  while (etat.events.some(e => e.slug === slug)) slug = `${base}-${n++}`;
  return slug;
}

/** Inscrit ou met a jour un evenement dans le registre. */
export async function enregistrerEvenement(evenement: EventRecord): Promise<EventRecord> {
  const config = configRegistre();
  if (!config) {
    throw new SheetError(
      "Le classeur de la plateforme n'est pas configuré : renseignez PLATFORM_SHEET_URL.",
      409,
      'no_registry',
    );
  }

  const a_jour: EventRecord = { ...evenement, updatedAt: new Date().toISOString() };

  await writeRows(ONGLET_EVENEMENTS, [evenementVersLigne(a_jour)], {
    keyColumn: 'Identifiant',
    config,
  });

  const index = etat.events.findIndex(e => e.slug === a_jour.slug);
  if (index >= 0) etat.events[index] = a_jour;
  else etat.events.push(a_jour);

  return a_jour;
}

/** Inscrit ou met a jour un compte de plateforme. */
export async function enregistrerCompte(compte: PlatformAccount): Promise<PlatformAccount> {
  const config = configRegistre();
  if (!config) {
    throw new SheetError(
      "Le classeur de la plateforme n'est pas configuré : renseignez PLATFORM_SHEET_URL.",
      409,
      'no_registry',
    );
  }

  await writeRows(ONGLET_COMPTES, [compteVersLigne(compte)], { keyColumn: 'Email', config });

  const index = etat.accounts.findIndex(c => c.email === compte.email);
  if (index >= 0) etat.accounts[index] = compte;
  else etat.accounts.push(compte);

  return compte;
}
