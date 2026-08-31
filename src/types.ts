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

export type ParticipantRole = 'attendee' | 'speaker' | 'organizer' | 'volunteer' | 'sponsor' | 'super-admin';

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
  rooms: RoomConfig[];
  tracks: string[];
  allowExpressRegistration: boolean;
  maintenanceMode: boolean;
  enableAnonymousFeedback: boolean;
  autoSyncGoogleSheets: boolean;
  sessionReminderMinutes: number;
  /** Liens Google Doc / Sheet / Slides publies dans l'application. */
  docLinks: DocLink[];
}

