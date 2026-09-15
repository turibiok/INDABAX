export type SessionTrack = 
  | 'NLP & Langues Africaines'
  | 'Computer Vision & Santé'
  | 'Fondamentaux ML'
  | 'Generative AI & LLMs'
  | 'Entrepreneuriat & Éthique'
  | 'Keynote';

export type SessionType = 
  | 'Keynote'
  | 'Workshop'
  | 'Paper Presentation'
  | 'Panel'
  | 'Hackathon'
  | 'Networking';

export interface Session {
  id: string;
  title: string;
  speaker: string;
  speakerTitle: string;
  speakerInstitution: string;
  speakerPhoto: string;
  day: number; // 1, 2, 3
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  track: SessionTrack;
  type: SessionType;
  level: 'Débutant' | 'Intermédiaire' | 'Avancé' | 'Tous niveaux';
  description: string;
  prerequisites?: string;
  resourcesUrl?: string;
  slidesUrl?: string;
  capacity: number;
  currentAttendees: number;
}

/**
 * Identifiant d'un role. Volontairement ouvert : chaque evenement definit les
 * siens, et un stage de secourisme n'a pas les memes qu'un colloque.
 *
 * Les six identifiants ci-dessous restent fournis d'origine, parce qu'ils
 * portent les tableaux de bord existants et les comptes deja enregistres.
 */
export type ParticipantRole = string;

/** Les roles livres avec l'application, toujours presents. */
export type BuiltInRole =
  | 'attendee'
  | 'speaker'
  | 'organizer'
  | 'volunteer'
  | 'sponsor'
  | 'super-admin';

/**
 * Espace personnel affiche pour un role.
 *
 * Un role librement cree doit choisir lequel il reutilise : ecrire un
 * tableau de bord par role nouveau serait hors de portee des organisateurs,
 * alors que ces cinq formes couvrent ce qu'on rencontre.
 */
export type DashboardKind = 'admin' | 'organizer' | 'speaker' | 'volunteer' | 'attendee';

/** Onglets de navigation de l'application. */
export type AppTab =
  | 'schedule'
  | 'announcements'
  | 'discussions'
  | 'dashboard'
  | 'networking'
  | 'profile'
  | 'badge'
  | 'ai-guide';

/**
 * Ce qu'un role permet de faire.
 *
 * Ces champs vivent ici, et non aupres des roles fournis, parce que le serveur
 * s'en sert pour autoriser chaque requete : ils decrivent des droits reels, pas
 * un affichage.
 */
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
  /** Peut attribuer les roles aux emails, et definir les roles eux-memes. */
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

export interface Participant {
  id: string;
  ticketNumber: string;
  name: string;
  email: string;
  role: ParticipantRole;
  institution: string;
  position: string;
  country: string;
  city: string;
  avatarUrl: string;
  bio: string;
  interests: string[];
  github?: string;
  linkedin?: string;
  twitter?: string;
  /** Site personnel, portfolio ou page de l'organisation. */
  website?: string;
  /** Renseigné par la personne : le plus souvent son numéro WhatsApp. */
  phone?: string;
  checkedInSessions: string[];
}

export interface CheckInRecord {
  id: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  ticketNumber: string;
  sessionId: string;
  sessionTitle: string;
  room: string;
  timestamp: string;
  scannedBy: string;
  syncedToSheets: boolean;
}

export interface SessionFeedback {
  id: string;
  sessionId: string;
  sessionTitle: string;
  participantId: string;
  participantName: string;
  overallRating: number; // 1 to 5
  contentQuality: number; // 1 to 5
  speakerClarity: number; // 1 to 5
  practicalRelevance: number; // 1 to 5
  comments: string;
  questionForSpeaker?: string;
  timestamp: string;
  syncedToSheets: boolean;
}

export interface NetworkingConnection {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerInstitution: string;
  partnerRole: string;
  partnerInterests: string[];
  partnerAvatar?: string;
  metAtSession?: string;
  notes?: string;
  timestamp: string;
}

/**
 * Configuration de la base de donnees Google Sheet / AppSheet, telle que le
 * serveur l'expose au client.
 *
 * Aucun projet Google Cloud ni Firebase n'est requis : on ne manipule que des
 * LIENS partages. La configuration reelle, y compris les secrets d'ecriture
 * (URL Apps Script, cle AppSheet), vit uniquement cote serveur ; le client n'en
 * connait que l'existence, via `hasWebhook` et `hasAppSheetApi`.
 */
export interface PublicSheetsConfig {
  /** Lien du classeur Google Sheet qui sert de base de donnees (celui d'AppSheet). */
  masterSheetUrl: string;
  /**
   * Noms des onglets du classeur.
   *
   * « profilesTab » remplace les deux anciens onglets, comptes et annuaire :
   * une personne y tient une seule ligne, qui sert autant à la connexion
   * qu'à l'affichage de son profil.
   */
  profilesTab: string;
  sessionsTab: string;
  checkInsTab: string;
  feedbacksTab: string;
  announcementsTab: string;
  messagesTab: string;
  isLinked: boolean;
  autoSync: boolean;
  lastSyncTimestamp?: string;
  lastError?: string;
  /** Une voie d'ecriture est configuree, sans en reveler les identifiants. */
  canWrite: boolean;
  hasWebhook: boolean;
  hasAppSheetApi: boolean;
}

export type AccountStatus = 'active' | 'pending' | 'suspended';

/**
 * Un compte de la table `Utilisateurs` du Google Sheet.
 * C'est l'admin qui y attribue le role associe a chaque email.
 */
export interface UserAccount {
  email: string;
  name: string;
  role: ParticipantRole;
  status: AccountStatus;
  /**
   * Mot de passe en clair. Transitoire : c'est la valeur lue dans la colonne
   * « Mot de passe » du classeur. Le serveur la hache des sa premiere lecture
   * et ne la conserve jamais sur disque.
   */
  password?: string;
  /** Empreinte scrypt du mot de passe. Cote serveur uniquement. */
  passwordHash?: string;
  institution?: string;
  position?: string;
  ticketNumber?: string;
  avatarUrl?: string;
  assignedBy?: string;
  assignedAt?: string;
  /* Informations de profil, venues de la même ligne du classeur. */
  country?: string;
  city?: string;
  bio?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  interests?: string[];
}

/**
 * Compte tel que le serveur l'expose : ni le mot de passe ni son empreinte ne
 * sont transmis, seule l'existence d'un mot de passe est signalee.
 */
export type PublicUserAccount = Omit<UserAccount, 'password' | 'passwordHash'> & {
  hasPassword: boolean;
};

export type DocLinkKind = 'doc' | 'sheet' | 'slides' | 'form' | 'drive' | 'other';

/** Lien Google Doc / Sheet / Slides expose dans l'application. */
export interface DocLink {
  id: string;
  label: string;
  description?: string;
  url: string;
  kind: DocLinkKind;
  /** 'all' ou la liste des roles autorises a voir le lien. */
  visibleTo: 'all' | ParticipantRole[];
}

/**
 * Session ouverte, telle que le serveur la decrit.
 * L'identifiant de session n'apparait jamais ici : il reste dans un cookie
 * HttpOnly, inaccessible au JavaScript de la page.
 */
export interface AuthSession {
  email: string;
  role: ParticipantRole;
  name: string;
  status: AccountStatus;
  /** 'sheet' = role lu dans le Google Sheet, 'local' = table serveur, 'bootstrap' = ADMIN_EMAILS. */
  source: 'sheet' | 'local' | 'bootstrap';
  signedInAt: string;
  expiresAt: string;
}

export interface AIMatchmakingRecommendation {
  attendeeId: string;
  name: string;
  reason: string;
  icebreaker: string;
}

// Announcements & Notifications
export type AnnouncementCategory = 'URGENT' | 'PROGRAMME' | 'LOGISTIQUE' | 'KEYNOTE' | 'SOCIAL' | 'HACKATHON';

export interface AnnouncementComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: ParticipantRole;
  authorAvatar: string;
  content: string;
  timestamp: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: 'normal' | 'high' | 'urgent';
  authorName: string;
  authorRole: ParticipantRole;
  authorAvatar: string;
  timestamp: string;
  pinned: boolean;
  likes: number;
  likedBy: string[];
  comments: AnnouncementComment[];
  targetAudience?: 'all' | 'speakers' | 'volunteers' | 'attendees';
}

// Discussions & Community Chats
export interface ChatChannel {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  isPrivate?: boolean;
  memberCount: number;
}

export interface ChatMessage {
  id: string;
  channelId?: string;
  conversationId?: string;
  senderId: string;
  senderName: string;
  senderRole: ParticipantRole;
  senderAvatar: string;
  content: string;
  timestamp: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['usr-001', 'usr-002'] }
  attachmentUrl?: string;
  attachmentType?: 'image' | 'link' | 'code';
}

export interface DirectConversation {
  id: string;
  partner: Participant;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

// Speaker Resources & Question Management
export interface SpeakerResource {
  id: string;
  sessionId: string;
  title: string;
  type: 'slides' | 'notebook' | 'dataset' | 'paper' | 'github';
  url: string;
  uploadedAt: string;
}

export interface SpeakerQuestionStatus {
  id: string;
  feedbackId: string;
  sessionId: string;
  question: string;
  askedBy: string;
  status: 'pending' | 'answered' | 'flagged';
  answerText?: string;
  timestamp: string;
}

// Volunteer Incident & Status Logs
export interface VolunteerLog {
  id: string;
  volunteerId: string;
  volunteerName: string;
  room: string;
  type: 'incident' | 'request' | 'capacity_alert' | 'general';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: string;
  status: 'open' | 'resolved';
}

// Local Push Notification Alerts
export interface PushNotificationAlert {
  id: string;
  sessionId: string;
  sessionTitle: string;
  speaker: string;
  room: string;
  startTime: string;
  minutesRemaining: number;
  timestamp: string;
  read: boolean;
}

// Import Summary
export interface ImportSummary {
  type: 'participants' | 'sessions' | 'announcements';
  totalImported: number;
  totalSkipped: number;
  errors: string[];
}

// Event & Super-Admin Configuration
export interface RoomConfig {
  id: string;
  name: string;
  capacity: number;
  locationNotes?: string;
  hasStream?: boolean;
}

export interface EventConfig {
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
  /** Préfixe des numéros de billet. Vide : fabriqué depuis le nom. */
  ticketPrefix: string;
  rooms: RoomConfig[];
  tracks: string[];
  allowExpressRegistration: boolean;
  maintenanceMode: boolean;
  enableAnonymousFeedback: boolean;
  autoSyncGoogleSheets: boolean;
  sessionReminderMinutes: number;
  /** Liens Google Doc / Sheet / Slides publies dans l'application. */
  docLinks: DocLink[];
  /**
   * Roles de cet evenement et droits de chacun.
   *
   * Vide, l'application retombe sur les six roles fournis : un evenement
   * existant continue donc de fonctionner sans rien declarer.
   */
  roles: EventRole[];
  /** Mots employes par l'interface, pour coller au type d'evenement. */
  terminology: EventTerminology;
  /** Identite visuelle : logo et couleurs. */
  branding: EventBranding;
}

/**
 * Un role tel que l'evenement le definit.
 *
 * Les droits sont portes par le role lui-meme plutot que deduits de son nom :
 * c'est ce qui permet d'en creer librement sans toucher au code, et c'est le
 * serveur qui tranche, jamais le navigateur.
 */
export interface EventRole extends RoleCapabilities {
  /** Identifiant stable, ecrit dans le classeur et dans les sessions. */
  id: string;
  /** Espace personnel reutilise par ce role. */
  dashboard: DashboardKind;
  /** Teinte du badge, parmi une liste fermee pour rester lisible. */
  accent: RoleAccent;
  /**
   * Role fourni d'origine : son identifiant ne peut pas etre change ni
   * supprime, sans quoi les comptes deja enregistres perdraient leur role.
   */
  builtIn?: boolean;
}

/** Teintes proposees pour les badges de role. */
export type RoleAccent =
  | 'rouge'
  | 'ambre'
  | 'indigo'
  | 'emeraude'
  | 'violet'
  | 'ardoise'
  | 'ciel'
  | 'rose';

/**
 * Les mots de l'interface.
 *
 * « Conference » n'a pas de conferenciers dans un tournoi ni de sessions dans
 * un mariage. Chaque champ porte le mot au singulier et au pluriel, faute de
 * quoi le francais oblige a des tournures qui se voient.
 */
export interface EventTerminology {
  /** « session » / « sessions » — l'unite du programme. */
  session: string;
  sessions: string;
  /** « émargement » / « émargements » — le pointage des presences. */
  checkIn: string;
  checkIns: string;
  /** « programme » — la vue d'ensemble du deroule. */
  schedule: string;
  /** « salle » / « salles » — les lieux ou se tiennent les sessions. */
  room: string;
  rooms: string;
  /** « thématique » / « thématiques » — le classement des sessions. */
  track: string;
  tracks: string;
  /** « badge » — le laissez-passer personnel. */
  badge: string;
  /** « avis » — les retours laisses sur une session. */
  feedback: string;
  feedbacks: string;
}

/** Identite visuelle de l'evenement. */
export interface EventBranding {
  /** Logo affiche sur fond clair. Vide : celui livre avec l'application. */
  logoUrl: string;
  /** Variante pour fond sombre, quand le logo clair y disparaitrait. */
  logoDarkUrl: string;
  /** Couleur dominante, en hexadecimal. */
  primaryColor: string;
  /** Couleur d'accent, en hexadecimal. */
  accentColor: string;
}