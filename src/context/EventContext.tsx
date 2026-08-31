import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Session,
  Participant,
  CheckInRecord,
  SessionFeedback,
  NetworkingConnection,
  PublicSheetsConfig,
  PublicUserAccount,
  AuthSession,
  ParticipantRole,
  DocLink,
  Announcement,
  ChatChannel,
  ChatMessage,
  SpeakerResource,
  VolunteerLog,
  PushNotificationAlert,
  EventConfig
} from '../types';
import {
  INITIAL_SESSIONS,
  INITIAL_PARTICIPANTS,
  INITIAL_CHECKINS,
  INITIAL_FEEDBACKS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_CHANNELS,
  INITIAL_CHAT_MESSAGES,
  INITIAL_SPEAKER_RESOURCES,
  INITIAL_VOLUNTEER_LOGS,
  INITIAL_EVENT_CONFIG
} from '../data/mockData';
import { syncSessionToGoogle, downloadIcsFile } from '../services/calendarService';
import { notificationService } from '../services/notificationService';
import { rowsToParticipants, rowsToSessions } from '../services/sheetsDb';
import * as api from '../services/api';
import { ROLE_LABELS, RoleCapabilities, capabilitiesFor } from '../permissions';
import { normalizeEmail } from '../lib/sheets';

interface EventContextType {
  currentUser: Participant;
  setCurrentUser: (user: Participant) => void;
  sessions: Session[];
  participants: Participant[];
  checkIns: CheckInRecord[];
  feedbacks: SessionFeedback[];
  connections: NetworkingConnection[];
  savedSessionIds: string[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTrack: string;
  setSelectedTrack: (track: string) => void;
  // Authentification par email (role attribue par l'administrateur, verifie par le serveur)
  authStatus: 'loading' | 'anonymous' | 'authenticated';
  authSession: AuthSession | null;
  authWarning: string | null;
  isAuthenticating: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Changement de son propre mot de passe : l'actuel est exigé. */
  changeMyPassword: (currentPassword: string, newPassword: string) => Promise<string>;
  /** Role reellement attribue au compte connecte. */
  realRole: ParticipantRole;
  /** Role effectivement applique a l'interface (previsualisation Super-Admin incluse). */
  effectiveRole: ParticipantRole;
  capabilities: RoleCapabilities;
  previewRole: ParticipantRole | null;
  setPreviewRole: (role: ParticipantRole | null) => void;
  refreshMyRole: () => Promise<string>;

  // Comptes et attribution des roles (le serveur refuse si le role ne le permet pas)
  userAccounts: PublicUserAccount[];
  assignRole: (email: string, role: ParticipantRole, extra?: AssignRoleExtra) => Promise<string>;
  setAccountStatus: (email: string, status: PublicUserAccount['status']) => Promise<string>;
  removeAccount: (email: string) => Promise<string>;
  refreshAccounts: () => Promise<void>;
  reloadAccountsFromSheet: () => Promise<string>;

  // Base de donnees Google Sheet (liens uniquement, sans Google Cloud ni Firebase).
  // Les secrets d'ecriture restent sur le serveur : seule leur existence est connue ici.
  sheetsConfig: PublicSheetsConfig;
  saveSheetsSettings: (patch: SheetsSettingsPatch) => Promise<string>;
  isSheetsLinked: boolean;
  canWriteToSheets: boolean;
  linkSheetsDatabase: (sheetUrl: string, usersTab?: string) => Promise<string>;
  unlinkSheetsDatabase: () => Promise<string>;
  importFromSheets: (what: 'participants' | 'sessions') => Promise<string>;
  pushDataToSheets: () => Promise<string>;
  isSyncing: boolean;

  // Liens Google Doc / Sheet publies dans l'application
  docLinks: DocLink[];
  visibleDocLinks: DocLink[];
  saveDocLink: (link: DocLink) => void;
  removeDocLink: (id: string) => void;

  // Dark Theme Mode
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Local Push Notifications
  activeAlerts: PushNotificationAlert[];
  dismissAlert: (id: string) => void;
  testPushNotification: () => void;
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<NotificationPermission>;

  // Modals & Navigation
  isSheetsSetupOpen: boolean;
  setIsSheetsSetupOpen: (open: boolean) => void;
  // Scanner QR : porte par le contexte pour etre ouvrable depuis n'importe quel tableau de bord
  isScannerOpen: boolean;
  scannerTargetSession: Session | null;
  openScanner: (session?: Session | null) => void;
  closeScanner: () => void;
  isImportModalOpen: boolean;
  setIsImportModalOpen: (open: boolean) => void;

  // Event Configuration & Super Admin
  eventConfig: EventConfig;
  updateEventConfig: (updated: Partial<EventConfig>) => void;

  // Announcements & Discussions
  announcements: Announcement[];
  channels: ChatChannel[];
  chatMessages: ChatMessage[];
  speakerResources: SpeakerResource[];
  volunteerLogs: VolunteerLog[];
  activeChannelId: string;
  setActiveChannelId: (id: string) => void;
  activeDirectPartnerId: string | null;
  setActiveDirectPartnerId: (id: string | null) => void;

  // Content Modification & Management (Super-Admin CRUD)
  addSession: (session: Omit<Session, 'id' | 'currentAttendees'>) => void;
  updateSession: (sessionId: string, updated: Partial<Session>) => void;
  deleteSession: (sessionId: string) => void;

  addParticipant: (participant: Omit<Participant, 'id' | 'ticketNumber' | 'checkedInSessions'>) => Participant;
  updateParticipant: (participantId: string, updated: Partial<Participant>) => void;
  deleteParticipant: (participantId: string) => void;

  updateAnnouncement: (announcementId: string, updated: Partial<Announcement>) => void;
  deleteAnnouncement: (announcementId: string) => void;
  togglePinAnnouncement: (announcementId: string) => void;

  addChannel: (channel: Omit<ChatChannel, 'id' | 'memberCount'>) => void;
  deleteChannel: (channelId: string) => void;

  // Actions
  checkInParticipant: (ticketOrId: string, sessionId: string, scannedBy?: string) => Promise<{ success: boolean; message: string; participant?: Participant }>;
  submitFeedback: (feedback: Omit<SessionFeedback, 'id' | 'timestamp' | 'syncedToSheets'>) => Promise<boolean>;
  updateUserProfile: (updated: Partial<Participant>) => void;
  addConnection: (partner: Participant, notes?: string) => void;
  toggleSaveSession: (sessionId: string) => void;
  exportToCsv: (type: 'checkins' | 'feedbacks' | 'participants' | 'sessions' | 'announcements' | 'logs') => void;
  addSessionToCalendar: (session: Session) => Promise<{ success: boolean; message: string; url?: string }>;
  syncAllSavedSessionsToGoogleCalendar: () => Promise<{ count: number; message: string }>;
  downloadAllSavedSessionsIcs: () => void;

  // Data Ingestion, Full Backup & Restore Actions
  importParticipants: (newParticipants: Participant[]) => void;
  importSessions: (newSessions: Session[]) => void;
  importAnnouncements: (newAnnouncements: Announcement[]) => void;
  exportFullDatabaseJson: () => void;
  importFullDatabaseJson: (jsonData: any) => { success: boolean; message: string };
  resetToDefaultData: () => void;
  exportAllCsvBundle: () => void;
  downloadTemplateCsv: (type: 'participants' | 'sessions' | 'announcements') => void;

  // Announcements actions
  addAnnouncement: (announcement: Omit<Announcement, 'id' | 'timestamp' | 'likes' | 'likedBy' | 'comments'>) => void;
  likeAnnouncement: (announcementId: string) => void;
  addAnnouncementComment: (announcementId: string, content: string) => void;

  // Chat actions
  sendChannelMessage: (channelId: string, content: string, attachmentUrl?: string, attachmentType?: 'image' | 'link' | 'code') => void;
  sendDirectMessage: (receiverId: string, content: string) => void;
  reactToMessage: (messageId: string, emoji: string) => void;

  // Speaker actions
  addSpeakerResource: (resource: Omit<SpeakerResource, 'id' | 'uploadedAt'>) => void;

  // Volunteer actions
  addVolunteerLog: (log: Omit<VolunteerLog, 'id' | 'timestamp' | 'status'>) => void;
  resolveVolunteerLog: (logId: string) => void;
}

export interface AssignRoleExtra {
  name?: string;
  status?: PublicUserAccount['status'];
  /** Mot de passe choisi par l'administrateur. */
  password?: string;
  /** Demande au serveur d'en générer un, renvoyé une seule fois. */
  generatePassword?: boolean;
  institution?: string;
  position?: string;
}

export interface SheetsSettingsPatch {
  usersTab?: string;
  participantsTab?: string;
  sessionsTab?: string;
  checkInsTab?: string;
  feedbacksTab?: string;
  autoSync?: boolean;
  writeWebhookUrl?: string;
  appSheetAppId?: string;
  appSheetAccessKey?: string;
}

const EMPTY_SHEETS_CONFIG: PublicSheetsConfig = {
  masterSheetUrl: '',
  usersTab: 'Utilisateurs',
  participantsTab: 'Participants',
  sessionsTab: 'Sessions',
  checkInsTab: 'Check-ins',
  feedbacksTab: 'Feedbacks',
  isLinked: false,
  autoSync: true,
  canWrite: false,
  hasWebhook: false,
  hasAppSheetApi: false,
};

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Storage initializers
  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('indabax_sessions');
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
  });

  const [participants, setParticipants] = useState<Participant[]>(() => {
    const saved = localStorage.getItem('indabax_participants');
    return saved ? JSON.parse(saved) : INITIAL_PARTICIPANTS;
  });

  const [currentUser, setCurrentUser] = useState<Participant>(() => {
    const saved = localStorage.getItem('indabax_current_user');
    return saved ? JSON.parse(saved) : INITIAL_PARTICIPANTS[0];
  });

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(() => {
    const saved = localStorage.getItem('indabax_checkins');
    return saved ? JSON.parse(saved) : INITIAL_CHECKINS;
  });

  const [feedbacks, setFeedbacks] = useState<SessionFeedback[]>(() => {
    const saved = localStorage.getItem('indabax_feedbacks');
    return saved ? JSON.parse(saved) : INITIAL_FEEDBACKS;
  });

  const [connections, setConnections] = useState<NetworkingConnection[]>(() => {
    const saved = localStorage.getItem('indabax_connections');
    return saved ? JSON.parse(saved) : [];
  });

  const [savedSessionIds, setSavedSessionIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('indabax_saved_sessions');
    return saved ? JSON.parse(saved) : ['ses-101', 'ses-201', 'ses-202'];
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const saved = localStorage.getItem('indabax_announcements');
    return saved ? JSON.parse(saved) : INITIAL_ANNOUNCEMENTS;
  });

  const [channels, setChannels] = useState<ChatChannel[]>(() => {
    const saved = localStorage.getItem('indabax_channels');
    return saved ? JSON.parse(saved) : INITIAL_CHANNELS;
  });

  const [eventConfig, setEventConfig] = useState<EventConfig>(() => {
    const saved = localStorage.getItem('indabax_event_config');
    return saved ? JSON.parse(saved) : INITIAL_EVENT_CONFIG;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('indabax_chat_messages');
    return saved ? JSON.parse(saved) : INITIAL_CHAT_MESSAGES;
  });

  const [speakerResources, setSpeakerResources] = useState<SpeakerResource[]>(() => {
    const saved = localStorage.getItem('indabax_speaker_resources');
    return saved ? JSON.parse(saved) : INITIAL_SPEAKER_RESOURCES;
  });

  const [volunteerLogs, setVolunteerLogs] = useState<VolunteerLog[]>(() => {
    const saved = localStorage.getItem('indabax_volunteer_logs');
    return saved ? JSON.parse(saved) : INITIAL_VOLUNTEER_LOGS;
  });

  // Dark Theme Mode
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('indabax_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('indabax_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Modals state
  const [isSheetsSetupOpen, setIsSheetsSetupOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTargetSession, setScannerTargetSession] = useState<Session | null>(null);

  const openScanner = (session: Session | null = null) => {
    setScannerTargetSession(session);
    setIsScannerOpen(true);
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setScannerTargetSession(null);
  };

  // Authentification : la session vit sur le serveur, dans un cookie HttpOnly.
  // Le client ne fait que refleter ce que le serveur lui repond.
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [serverCapabilities, setServerCapabilities] = useState<RoleCapabilities | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'anonymous' | 'authenticated'>('loading');
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [previewRole, setPreviewRole] = useState<ParticipantRole | null>(null);
  const [userAccounts, setUserAccounts] = useState<PublicUserAccount[]>([]);

  // Push Notifications Alerts State
  const [activeAlerts, setActiveAlerts] = useState<PushNotificationAlert[]>([]);
  const [alertedSessionIds, setAlertedSessionIds] = useState<Set<string>>(new Set());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    notificationService.getPermissionStatus()
  );

  const requestNotificationPermission = async () => {
    const status = await notificationService.requestPermission();
    setNotificationPermission(status);
    return status;
  };

  const dismissAlert = (alertId: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const testPushNotification = () => {
    const savedSessions = sessions.filter(s => savedSessionIds.includes(s.id));
    const targetSession = savedSessions[0] || sessions[0];

    const mockAlert: PushNotificationAlert = {
      id: `alert-test-${Date.now()}`,
      sessionId: targetSession.id,
      sessionTitle: targetSession.title,
      speaker: targetSession.speaker,
      room: targetSession.room,
      startTime: targetSession.startTime,
      minutesRemaining: 15,
      timestamp: new Date().toISOString(),
      read: false
    };

    setActiveAlerts(prev => [mockAlert, ...prev]);
    notificationService.sendPushNotification(`⏰ Début dans 15 min : ${targetSession.title}`, {
      body: `Avec ${targetSession.speaker} en ${targetSession.room}. Rejoignez la salle !`,
      tag: `test-session-${targetSession.id}`
    });
  };

  // Periodic 30s check for upcoming sessions in ~15 min
  useEffect(() => {
    const checkUpcoming = () => {
      const newAlerts = notificationService.checkUpcomingSessions(
        sessions,
        savedSessionIds,
        alertedSessionIds
      );

      if (newAlerts.length > 0) {
        setActiveAlerts(prev => [...newAlerts, ...prev]);
        setAlertedSessionIds(prev => {
          const updated = new Set(prev);
          newAlerts.forEach(a => updated.add(a.sessionId));
          return updated;
        });
      }
    };

    checkUpcoming();
    const interval = setInterval(checkUpcoming, 30000);
    return () => clearInterval(interval);
  }, [sessions, savedSessionIds, alertedSessionIds]);

  const [activeTab, setActiveTab] = useState<string>('schedule');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [activeChannelId, setActiveChannelId] = useState<string>('chan-general');
  const [activeDirectPartnerId, setActiveDirectPartnerId] = useState<string | null>(null);

  // Configuration publique du classeur, servie par le serveur.
  const [sheetsConfig, setSheetsConfig] = useState<PublicSheetsConfig>(EMPTY_SHEETS_CONFIG);

  const isSheetsLinked = sheetsConfig.isLinked;
  const canWriteToSheets = sheetsConfig.canWrite;

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('indabax_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('indabax_participants', JSON.stringify(participants));
  }, [participants]);

  useEffect(() => {
    localStorage.setItem('indabax_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('indabax_checkins', JSON.stringify(checkIns));
  }, [checkIns]);

  useEffect(() => {
    localStorage.setItem('indabax_feedbacks', JSON.stringify(feedbacks));
  }, [feedbacks]);

  useEffect(() => {
    localStorage.setItem('indabax_connections', JSON.stringify(connections));
  }, [connections]);

  useEffect(() => {
    localStorage.setItem('indabax_saved_sessions', JSON.stringify(savedSessionIds));
  }, [savedSessionIds]);

  useEffect(() => {
    localStorage.setItem('indabax_announcements', JSON.stringify(announcements));
  }, [announcements]);

  useEffect(() => {
    localStorage.setItem('indabax_chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('indabax_speaker_resources', JSON.stringify(speakerResources));
  }, [speakerResources]);

  useEffect(() => {
    localStorage.setItem('indabax_volunteer_logs', JSON.stringify(volunteerLogs));
  }, [volunteerLogs]);

  useEffect(() => {
    localStorage.setItem('indabax_channels', JSON.stringify(channels));
  }, [channels]);

  useEffect(() => {
    localStorage.setItem('indabax_event_config', JSON.stringify(eventConfig));
  }, [eventConfig]);

  // La configuration du classeur, les comptes et la session ne sont plus
  // persistes dans le navigateur : le serveur en est le seul detenteur.
  // Au demarrage, on lui demande l'etat courant.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const config = await api.fetchSheetsConfig();
        if (!cancelled) setSheetsConfig(config);
      } catch (error) {
        console.warn('Configuration du classeur indisponible :', error);
      }

      try {
        const payload = await api.currentSession();
        if (cancelled) return;

        if (payload) {
          setAuthSession(payload.session);
          setServerCapabilities(payload.capabilities);
          setAuthStatus('authenticated');
        } else {
          setAuthStatus('anonymous');
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Session indisponible :', error);
          setAuthStatus('anonymous');
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Check-In Action
  const checkInParticipant = async (
    ticketOrId: string,
    sessionId: string,
    scannedBy: string = "Scanner Mobile"
  ): Promise<{ success: boolean; message: string; participant?: Participant }> => {
    const cleanQuery = ticketOrId.trim().toUpperCase();

    let searchTicket = cleanQuery;
    let searchEmail = cleanQuery.toLowerCase();

    try {
      if (cleanQuery.startsWith('{') && cleanQuery.endsWith('}')) {
        const parsed = JSON.parse(ticketOrId);
        if (parsed.ticketNumber) searchTicket = parsed.ticketNumber.toUpperCase();
        if (parsed.email) searchEmail = parsed.email.toLowerCase();
        if (parsed.id) searchTicket = parsed.id.toUpperCase();
      }
    } catch (e) {}

    let participant = participants.find(p =>
      p.ticketNumber.toUpperCase() === searchTicket ||
      p.id.toUpperCase() === searchTicket ||
      p.email.toLowerCase() === searchEmail ||
      p.name.toUpperCase() === cleanQuery
    );

    if (!participant) {
      if (cleanQuery.includes('@')) {
        participant = {
          id: `usr-${Date.now().toString().slice(-4)}`,
          ticketNumber: `INDABAX-BJ-2026-${Math.floor(100 + Math.random() * 900)}`,
          name: cleanQuery.split('@')[0].replace('.', ' '),
          email: cleanQuery.toLowerCase(),
          role: 'attendee',
          institution: 'IndabaX Bénin Participant',
          position: 'Auditeur Libre',
          country: 'Bénin',
          city: 'Cotonou',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
          bio: 'Nouveau participant enregistré sur place.',
          interests: ['Deep Learning', 'IA Bénin'],
          checkedInSessions: []
        };
        setParticipants(prev => [participant!, ...prev]);
      } else {
        return {
          success: false,
          message: `Participant non trouvé pour le code: "${ticketOrId}". Vérifiez le billet.`
        };
      }
    }

    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return { success: false, message: "Session introuvable." };
    }

    const existingCheckIn = checkIns.find(c =>
      (c.participantId === participant!.id || c.participantEmail === participant!.email) &&
      c.sessionId === sessionId
    );

    if (existingCheckIn) {
      return {
        success: true,
        message: `⚠️ ${participant.name} est DÉJÀ enregistré(e) pour cette session (${new Date(existingCheckIn.timestamp).toLocaleTimeString()}).`,
        participant
      };
    }

    const newRecord: CheckInRecord = {
      id: `chk-${Date.now()}`,
      participantId: participant.id,
      participantName: participant.name,
      participantEmail: participant.email,
      ticketNumber: participant.ticketNumber,
      sessionId: session.id,
      sessionTitle: session.title,
      room: session.room,
      timestamp: new Date().toISOString(),
      scannedBy,
      syncedToSheets: false,
    };

    setCheckIns(prev => [newRecord, ...prev]);

    setParticipants(prev => prev.map(p => {
      if (p.id === participant!.id) {
        return {
          ...p,
          checkedInSessions: [...new Set([...p.checkedInSessions, sessionId])]
        };
      }
      return p;
    }));

    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, currentAttendees: s.currentAttendees + 1 };
      }
      return s;
    }));

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#6366f1']
      });
    } catch (e) {}

    if (isSheetsLinked && sheetsConfig.autoSync && canWriteToSheets) {
      // Le serveur reconstruit la ligne et y inscrit l'auteur reel du scan.
      api
        .appendCheckIns([newRecord])
        .then(() => {
          setCheckIns(curr => curr.map(item => (item.id === newRecord.id ? { ...item, syncedToSheets: true } : item)));
        })
        .catch(error => console.warn('Présence non écrite dans le classeur :', error.message));
    }

    return {
      success: true,
      message: `✅ Présence confirmée : ${participant.name} (${participant.role.toUpperCase()}) pour "${session.title}".`,
      participant
    };
  };

  // Submit Feedback
  const submitFeedback = async (feedbackData: Omit<SessionFeedback, 'id' | 'timestamp' | 'syncedToSheets'>): Promise<boolean> => {
    const newFeedback: SessionFeedback = {
      ...feedbackData,
      id: `fbk-${Date.now()}`,
      timestamp: new Date().toISOString(),
      syncedToSheets: false,
    };

    setFeedbacks(prev => [newFeedback, ...prev]);

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#f59e0b', '#10b981']
      });
    } catch (e) {}

    if (isSheetsLinked && sheetsConfig.autoSync && canWriteToSheets) {
      api
        .appendFeedbacks([newFeedback])
        .then(() => {
          setFeedbacks(curr => curr.map(item => (item.id === newFeedback.id ? { ...item, syncedToSheets: true } : item)));
        })
        .catch(error => console.warn('Feedback non écrit dans le classeur :', error.message));
    }

    return true;
  };

  // Update Profile
  const updateUserProfile = (updated: Partial<Participant>) => {
    const updatedUser = { ...currentUser, ...updated };
    setCurrentUser(updatedUser);
    setParticipants(prev => prev.map(p => p.id === updatedUser.id ? updatedUser : p));
  };

  // Add Networking Connection
  const addConnection = (partner: Participant, notes?: string) => {
    if (connections.some(c => c.partnerId === partner.id)) return;

    const newConnection: NetworkingConnection = {
      id: `conn-${Date.now()}`,
      partnerId: partner.id,
      partnerName: partner.name,
      partnerEmail: partner.email,
      partnerInstitution: partner.institution,
      partnerRole: partner.role,
      partnerInterests: partner.interests,
      partnerAvatar: partner.avatarUrl,
      notes,
      timestamp: new Date().toISOString()
    };

    setConnections(prev => [newConnection, ...prev]);

    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#6366f1', '#ec4899']
      });
    } catch (e) {}
  };

  // Bookmark / Save Session
  const toggleSaveSession = (sessionId: string) => {
    setSavedSessionIds(prev =>
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    );
  };

  /* ------------------------------------------------------------------ *
   * Authentification : la decision appartient au serveur
   *
   * Le client n'evalue plus les roles lui-meme. Il transmet l'email, le
   * serveur consulte le classeur, cree une session et pose un cookie
   * HttpOnly. Les capacites affichees ici ne servent qu'a construire
   * l'interface : chaque route sensible les revalide cote serveur.
   * ------------------------------------------------------------------ */

  const realRole: ParticipantRole = authSession?.role || 'attendee';

  // Seul un Super-Admin peut previsualiser l'interface d'un autre role.
  // Son role reel, lui, ne change pas : le serveur continue de l'autoriser
  // comme Super-Admin.
  const effectiveRole: ParticipantRole =
    realRole === 'super-admin' && previewRole ? previewRole : realRole;

  const capabilities: RoleCapabilities =
    previewRole && realRole === 'super-admin'
      ? capabilitiesFor(previewRole)
      : serverCapabilities || capabilitiesFor(realRole);

  /** Retrouve la fiche participant liee a un compte, ou la cree si absente. */
  const resolveParticipantForSession = (session: AuthSession): Participant => {
    const email = normalizeEmail(session.email);
    const existing = participants.find(p => normalizeEmail(p.email) === email);

    if (existing) {
      // Le role venant du serveur prime sur celui stocke localement.
      const merged: Participant = { ...existing, role: session.role, name: session.name || existing.name };
      setParticipants(prev => prev.map(p => (p.id === existing.id ? merged : p)));
      return merged;
    }

    const created: Participant = {
      id: `usr-${Date.now().toString().slice(-6)}`,
      ticketNumber: `INDABAX-BJ-2026-${Math.floor(100 + Math.random() * 900)}`,
      name: session.name,
      email,
      role: session.role,
      institution: 'Non renseigné',
      position: 'Participant',
      country: 'Bénin',
      city: 'Cotonou',
      avatarUrl:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
      bio: '',
      interests: [],
      checkedInSessions: [],
    };

    setParticipants(prev => [created, ...prev]);
    return created;
  };

  const applyAuthPayload = (payload: api.AuthPayload) => {
    setAuthSession(payload.session);
    setServerCapabilities(payload.capabilities);
    setAuthStatus('authenticated');
    setAuthWarning(payload.warning || null);
    setPreviewRole(null);

    const profile = payload.profile;
    const participant = resolveParticipantForSession(payload.session);

    setCurrentUser(
      profile
        ? {
            ...participant,
            institution: profile.institution || participant.institution,
            position: profile.position || participant.position,
            ticketNumber: profile.ticketNumber || participant.ticketNumber,
            avatarUrl: profile.avatarUrl || participant.avatarUrl,
          }
        : participant,
    );
  };

  const signInWithEmail = async (email: string, password: string) => {
    setIsAuthenticating(true);
    setAuthWarning(null);

    try {
      const payload = await api.login(email, password);
      applyAuthPayload(payload);

      // On ouvre le premier onglet autorise pour ce role.
      setActiveTab(payload.capabilities.tabs[0] || 'schedule');

      try {
        confetti({ particleCount: 60, spread: 65, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b'] });
      } catch (e) {}
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signOut = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.warn('Déconnexion côté serveur impossible :', error);
    }

    setAuthSession(null);
    setServerCapabilities(null);
    setAuthStatus('anonymous');
    setAuthWarning(null);
    setPreviewRole(null);
    setUserAccounts([]);
    setActiveTab('schedule');
  };

  const changeMyPassword = async (currentPassword: string, newPassword: string): Promise<string> => {
    const result = await api.changePassword(currentPassword, newPassword);
    return result.message;
  };

  /** Relit le role depuis le classeur : utile si l'admin vient de le changer. */
  const refreshMyRole = async (): Promise<string> => {
    if (!authSession) return 'Aucune session ouverte.';

    try {
      const payload = await api.refreshSession();
      applyAuthPayload(payload);

      return payload.changed
        ? `Votre rôle a été mis à jour : ${ROLE_LABELS[payload.session.role]}.`
        : 'Votre rôle est déjà à jour.';
    } catch (error: any) {
      // Compte suspendu ou session expiree : le serveur nous a deconnectes.
      if (error?.status === 401 || error?.status === 403) {
        setAuthSession(null);
        setServerCapabilities(null);
        setAuthStatus('anonymous');
        return error.message;
      }
      throw error;
    }
  };

  /* ------------------------------------------------------------------ *
   * Comptes et attribution des roles
   *
   * Ces appels echouent avec un 403 si le role de la session ne porte pas
   * la capacite requise : la verification n'est pas seulement visuelle.
   * ------------------------------------------------------------------ */

  const refreshAccounts = async () => {
    try {
      setUserAccounts(await api.listAccounts());
    } catch (error: any) {
      // Un role sans droit de gestion n'a tout simplement pas de liste.
      if (error?.status !== 403 && error?.status !== 401) {
        console.warn('Comptes indisponibles :', error);
      }
      setUserAccounts([]);
    }
  };

  // La liste des comptes n'est chargee que pour les roles qui peuvent la gerer.
  useEffect(() => {
    if (authStatus === 'authenticated' && capabilities.canManageRoles) {
      refreshAccounts();
    }
  }, [authStatus, capabilities.canManageRoles]);

  const assignRole = async (
    email: string,
    role: ParticipantRole,
    extra: AssignRoleExtra = {},
  ): Promise<string> => {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('Adresse email invalide.');
    }

    const result = await api.assignRole({ email: cleanEmail, role, ...extra });

    setUserAccounts(prev => [
      result.account,
      ...prev.filter(account => normalizeEmail(account.email) !== cleanEmail),
    ]);

    setParticipants(prev =>
      prev.map(p => (normalizeEmail(p.email) === cleanEmail ? { ...p, role } : p)),
    );

    // Si l'admin modifie son propre role, sa session suit : on la relit.
    if (authSession && normalizeEmail(authSession.email) === cleanEmail) {
      await refreshMyRole();
    }

    try {
      confetti({ particleCount: 40, spread: 55, origin: { y: 0.5 } });
    } catch (e) {}

    const roleLabel = ROLE_LABELS[role];
    const sessionNote =
      result.sessionsUpdated > 0
        ? ` ${result.sessionsUpdated} session(s) ouverte(s) mise(s) à jour immédiatement.`
        : '';

    // Le mot de passe généré ne transite qu'une fois : il est affiché à
    // l'administrateur pour qu'il le transmette, puis oublié.
    const passwordNote = result.generatedPassword
      ? ` Mot de passe à transmettre : ${result.generatedPassword}`
      : result.passwordChanged
        ? ' Mot de passe enregistré.'
        : '';

    return `Rôle « ${roleLabel} » attribué à ${cleanEmail}.${sessionNote}${passwordNote}`;
  };

  const setAccountStatus = async (
    email: string,
    status: PublicUserAccount['status'],
  ): Promise<string> => {
    const cleanEmail = normalizeEmail(email);
    const existing = userAccounts.find(account => normalizeEmail(account.email) === cleanEmail);

    if (!existing) throw new Error('Compte introuvable.');

    const result = await api.assignRole({ email: cleanEmail, role: existing.role, status });

    setUserAccounts(prev =>
      prev.map(account => (normalizeEmail(account.email) === cleanEmail ? result.account : account)),
    );

    return status === 'suspended'
      ? `${cleanEmail} suspendu : ses sessions ouvertes ont été fermées.`
      : `Statut de ${cleanEmail} mis à jour.`;
  };

  const removeAccount = async (email: string): Promise<string> => {
    const cleanEmail = normalizeEmail(email);
    const result = await api.deleteAccount(cleanEmail);

    if (result.removed) {
      setUserAccounts(prev => prev.filter(account => normalizeEmail(account.email) !== cleanEmail));
      return `${cleanEmail} retiré de la table des comptes.`;
    }

    return `${cleanEmail} n'était pas dans la table des comptes.`;
  };

  const reloadAccountsFromSheet = async (): Promise<string> => {
    setIsSyncing(true);
    try {
      const result = await api.reloadAccounts();
      await refreshAccounts();
      setSheetsConfig(await api.fetchSheetsConfig());

      const sessionNote =
        result.sessionsUpdated > 0 ? ` ${result.sessionsUpdated} session(s) ouverte(s) réalignée(s).` : '';

      return `${result.count} compte(s) rechargé(s) depuis le classeur.${sessionNote}`;
    } finally {
      setIsSyncing(false);
    }
  };

  /* ------------------------------------------------------------------ *
   * Base de donnees Google Sheet : liaison par lien uniquement
   * ------------------------------------------------------------------ */

  const saveSheetsSettings = async (patch: SheetsSettingsPatch): Promise<string> => {
    setIsSyncing(true);
    try {
      setSheetsConfig(await api.saveSheetsConfig(patch));
      return 'Paramètres enregistrés sur le serveur.';
    } finally {
      setIsSyncing(false);
    }
  };

  const linkSheetsDatabase = async (sheetUrl: string, usersTab?: string): Promise<string> => {
    const url = sheetUrl.trim();
    if (!url) {
      throw new Error('Renseignez le lien de partage du classeur Google Sheet.');
    }

    setIsSyncing(true);
    try {
      const result = await api.linkSheet(url, usersTab);
      setSheetsConfig(result.config);
      await refreshAccounts();

      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch (e) {}

      return result.message;
    } catch (error) {
      // Le serveur a enregistre l'echec : on relit la config pour afficher
      // la derniere erreur constatee.
      try {
        setSheetsConfig(await api.fetchSheetsConfig());
      } catch (e) {}
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const unlinkSheetsDatabase = async (): Promise<string> => {
    setSheetsConfig(await api.unlinkSheet());
    return "Classeur délié : l'application repasse sur la table locale du serveur.";
  };

  /** Importe les participants ou les sessions depuis le classeur. */
  const importFromSheets = async (what: 'participants' | 'sessions'): Promise<string> => {
    setIsSyncing(true);
    try {
      const data = await api.fetchSheetData(what);

      if (what === 'participants') {
        const incoming = rowsToParticipants(data.rows);
        if (incoming.length === 0) {
          return `L'onglet « ${sheetsConfig.participantsTab} » ne contient aucun participant exploitable.`;
        }

        let added = 0;
        setParticipants(prev => {
          const known = new Set(prev.map(p => normalizeEmail(p.email)));
          const fresh = incoming.filter(p => p.email && !known.has(normalizeEmail(p.email)));
          added = fresh.length;
          return [...fresh, ...prev];
        });

        return `${added} nouveau(x) participant(s) importé(s) sur ${incoming.length} ligne(s) lues.`;
      }

      const incoming = rowsToSessions(data.rows);
      if (incoming.length === 0) {
        return `L'onglet « ${sheetsConfig.sessionsTab} » ne contient aucune session exploitable.`;
      }

      let added = 0;
      setSessions(prev => {
        const known = new Set(prev.map(session => session.title.toLowerCase()));
        const fresh = incoming.filter(session => !known.has(session.title.toLowerCase()));
        added = fresh.length;
        return [...prev, ...fresh];
      });

      return `${added} nouvelle(s) session(s) importée(s) sur ${incoming.length} ligne(s) lues.`;
    } finally {
      setIsSyncing(false);
    }
  };

  /** Envoie les présences et feedbacks non encore synchronisés vers le classeur. */
  const pushDataToSheets = async (): Promise<string> => {
    if (!isSheetsLinked) {
      throw new Error('Aucun classeur lié.');
    }
    if (!canWriteToSheets) {
      throw new Error(
        "Aucune voie d'écriture configurée. Renseignez l'URL d'un Apps Script Web App ou les identifiants AppSheet.",
      );
    }

    setIsSyncing(true);
    try {
      const pendingCheckIns = checkIns.filter(record => !record.syncedToSheets);
      const pendingFeedbacks = feedbacks.filter(feedback => !feedback.syncedToSheets);

      if (pendingCheckIns.length === 0 && pendingFeedbacks.length === 0) {
        return 'Tout est déjà synchronisé avec le classeur.';
      }

      const problems: string[] = [];

      if (pendingCheckIns.length > 0) {
        try {
          await api.appendCheckIns(pendingCheckIns);
          const ids = new Set(pendingCheckIns.map(record => record.id));
          setCheckIns(prev => prev.map(record => (ids.has(record.id) ? { ...record, syncedToSheets: true } : record)));
        } catch (error: any) {
          problems.push(`présences : ${error.message}`);
        }
      }

      if (pendingFeedbacks.length > 0) {
        try {
          await api.appendFeedbacks(pendingFeedbacks);
          const ids = new Set(pendingFeedbacks.map(feedback => feedback.id));
          setFeedbacks(prev =>
            prev.map(feedback => (ids.has(feedback.id) ? { ...feedback, syncedToSheets: true } : feedback)),
          );
        } catch (error: any) {
          problems.push(`feedbacks : ${error.message}`);
        }
      }

      setSheetsConfig(await api.fetchSheetsConfig());

      if (problems.length > 0) {
        throw new Error(`Envoi partiel — ${problems.join(' ; ')}`);
      }

      return `${pendingCheckIns.length} présence(s) et ${pendingFeedbacks.length} feedback(s) envoyés au classeur.`;
    } finally {
      setIsSyncing(false);
    }
  };

  /* ------------------------------------------------------------------ *
   * Liens Google Doc / Sheet exposes dans l'application
   * ------------------------------------------------------------------ */

  const docLinks = eventConfig.docLinks || [];

  const visibleDocLinks = useMemo(
    () =>
      docLinks.filter(
        link =>
          link.url.trim() !== '' &&
          (link.visibleTo === 'all' || link.visibleTo.includes(effectiveRole)),
      ),
    [docLinks, effectiveRole],
  );

  const saveDocLink = (link: DocLink) => {
    setEventConfig(prev => {
      const others = (prev.docLinks || []).filter(existing => existing.id !== link.id);
      return { ...prev, docLinks: [...others, link] };
    });
  };

  const removeDocLink = (id: string) => {
    setEventConfig(prev => ({
      ...prev,
      docLinks: (prev.docLinks || []).filter(link => link.id !== id),
    }));
  };

  const exportToCsv = (type: 'checkins' | 'feedbacks' | 'participants' | 'sessions' | 'announcements' | 'logs') => {
    let csvContent = "data:text/csv;charset=utf-8,";
    let filename = `indabax-benin-${type}-${new Date().toISOString().slice(0, 10)}.csv`;

    if (type === 'checkins') {
      csvContent += "Date & Heure,Nom,Email,N° Billet,ID Session,Titre Session,Salle,Scanne Par\n";
      checkIns.forEach(c => {
        csvContent += `"${new Date(c.timestamp).toLocaleString()}","${c.participantName}","${c.participantEmail}","${c.ticketNumber}","${c.sessionId}","${c.sessionTitle.replace(/"/g, '""')}","${c.room}","${c.scannedBy}"\n`;
      });
    } else if (type === 'feedbacks') {
      csvContent += "Date & Heure,Session,Nom,Note Globale,Qualite Contenu,Clarte Speaker,Pertinence Pratique,Commentaires,Question\n";
      feedbacks.forEach(f => {
        csvContent += `"${new Date(f.timestamp).toLocaleString()}","${f.sessionTitle.replace(/"/g, '""')}","${f.participantName}",${f.overallRating},${f.contentQuality},${f.speakerClarity},${f.practicalRelevance},"${f.comments.replace(/"/g, '""')}","${(f.questionForSpeaker || '').replace(/"/g, '""')}"\n`;
      });
    } else if (type === 'participants') {
      csvContent += "ID,N° Billet,Nom,Email,Role,Institution,Poste,Pays,Ville,Interets\n";
      participants.forEach(p => {
        csvContent += `"${p.id}","${p.ticketNumber}","${p.name}","${p.email}","${p.role}","${p.institution.replace(/"/g, '""')}","${p.position.replace(/"/g, '""')}","${p.country || ''}","${p.city || ''}","${p.interests.join(';')}"\n`;
      });
    } else if (type === 'sessions') {
      csvContent += "ID,Jour,Date,Heure Debut,Heure Fin,Titre,Intervenant,Institution,Salle,Track,Type,Niveau,Capacite,Presences\n";
      sessions.forEach(s => {
        csvContent += `"${s.id}",${s.day},"${s.date}","${s.startTime}","${s.endTime}","${s.title.replace(/"/g, '""')}","${s.speaker.replace(/"/g, '""')}","${s.speakerInstitution.replace(/"/g, '""')}","${s.room}","${s.track}","${s.type}","${s.level}",${s.capacity},${s.currentAttendees}\n`;
      });
    } else if (type === 'announcements') {
      csvContent += "ID,Date & Heure,Categorie,Priorite,Titre,Auteur,Likes,Commentaires,Contenu\n";
      announcements.forEach(a => {
        csvContent += `"${a.id}","${new Date(a.timestamp).toLocaleString()}","${a.category}","${a.priority}","${a.title.replace(/"/g, '""')}","${a.authorName}",${a.likes},${a.comments.length},"${a.content.replace(/"/g, '""')}"\n`;
      });
    } else if (type === 'logs') {
      csvContent += "ID,Date & Heure,Volontaire,Salle,Type,Gravite,Statut,Message\n";
      volunteerLogs.forEach(l => {
        csvContent += `"${l.id}","${new Date(l.timestamp).toLocaleString()}","${l.volunteerName}","${l.room}","${l.type}","${l.severity}","${l.status}","${l.message.replace(/"/g, '""')}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Google Calendar Operations
  const addSessionToCalendar = async (session: Session): Promise<{ success: boolean; message: string; url?: string }> => {
    return await syncSessionToGoogle(session);
  };

  const syncAllSavedSessionsToGoogleCalendar = async (): Promise<{ count: number; message: string }> => {
    const savedSessions = sessions.filter(s => savedSessionIds.includes(s.id));
    if (savedSessions.length === 0) {
      return { count: 0, message: "Aucune session n'est encore sélectionnée dans votre agenda personnel." };
    }

    // Export .ICS puis ouverture de la page d'import de Google Calendar :
    // aucune authentification n'est necessaire.
    downloadIcsFile(savedSessions, "IndabaX_Benin_2026_Mon_Agenda");
    window.open("https://calendar.google.com/calendar/u/0/r/settings/export", "_blank", "noopener,noreferrer");

    return {
      count: savedSessions.length,
      message: `📅 Fichier d'agenda généré et page d'importation Google Calendar ouverte pour vos ${savedSessions.length} session(s).`
    };
  };

  const downloadAllSavedSessionsIcs = () => {
    const savedSessions = sessions.filter(s => savedSessionIds.includes(s.id));
    downloadIcsFile(savedSessions.length > 0 ? savedSessions : sessions, "IndabaX_Benin_2026_Agenda_Complet");
  };

  // Announcements Actions
  const addAnnouncement = (announcementData: Omit<Announcement, 'id' | 'timestamp' | 'likes' | 'likedBy' | 'comments'>) => {
    const newAnn: Announcement = {
      ...announcementData,
      id: `ann-${Date.now()}`,
      timestamp: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      comments: []
    };
    setAnnouncements(prev => [newAnn, ...prev]);

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
    } catch (e) {}
  };

  const likeAnnouncement = (announcementId: string) => {
    setAnnouncements(prev => prev.map(ann => {
      if (ann.id === announcementId) {
        const isLiked = ann.likedBy.includes(currentUser.id);
        return {
          ...ann,
          likes: isLiked ? ann.likes - 1 : ann.likes + 1,
          likedBy: isLiked
            ? ann.likedBy.filter(id => id !== currentUser.id)
            : [...ann.likedBy, currentUser.id]
        };
      }
      return ann;
    }));
  };

  const addAnnouncementComment = (announcementId: string, content: string) => {
    if (!content.trim()) return;
    const comment = {
      id: `comm-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorAvatar: currentUser.avatarUrl,
      content,
      timestamp: new Date().toISOString()
    };

    setAnnouncements(prev => prev.map(ann => {
      if (ann.id === announcementId) {
        return {
          ...ann,
          comments: [...ann.comments, comment]
        };
      }
      return ann;
    }));
  };

  // Chat Actions
  const sendChannelMessage = (
    channelId: string,
    content: string,
    attachmentUrl?: string,
    attachmentType?: 'image' | 'link' | 'code'
  ) => {
    if (!content.trim() && !attachmentUrl) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      channelId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatarUrl,
      content,
      timestamp: new Date().toISOString(),
      reactions: {},
      attachmentUrl,
      attachmentType
    };

    setChatMessages(prev => [...prev, newMsg]);
  };

  const sendDirectMessage = (receiverId: string, content: string) => {
    if (!content.trim()) return;

    const partner = participants.find(p => p.id === receiverId);
    if (!partner) return;

    // Direct message convention: channelId = `dm_${[currentUser.id, receiverId].sort().join('_')}`
    const convId = `dm_${[currentUser.id, receiverId].sort().join('_')}`;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      channelId: convId,
      conversationId: convId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatarUrl,
      content,
      timestamp: new Date().toISOString(),
      reactions: {}
    };

    setChatMessages(prev => [...prev, newMsg]);
  };

  const reactToMessage = (messageId: string, emoji: string) => {
    setChatMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const reactions = { ...(m.reactions || {}) };
        const users = reactions[emoji] || [];
        const hasReacted = users.includes(currentUser.id);

        if (hasReacted) {
          reactions[emoji] = users.filter(id => id !== currentUser.id);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji] = [...users, currentUser.id];
        }

        return { ...m, reactions };
      }
      return m;
    }));
  };

  // Speaker Resource Actions
  const addSpeakerResource = (resourceData: Omit<SpeakerResource, 'id' | 'uploadedAt'>) => {
    const newRes: SpeakerResource = {
      ...resourceData,
      id: `res-${Date.now()}`,
      uploadedAt: new Date().toISOString()
    };
    setSpeakerResources(prev => [newRes, ...prev]);
  };

  // Volunteer Log Actions
  const addVolunteerLog = (logData: Omit<VolunteerLog, 'id' | 'timestamp' | 'status'>) => {
    const newLog: VolunteerLog = {
      ...logData,
      id: `vlog-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'open'
    };
    setVolunteerLogs(prev => [newLog, ...prev]);
  };

  const resolveVolunteerLog = (logId: string) => {
    setVolunteerLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'resolved' } : l));
  };

  // Import Mass Actions
  const importParticipants = (newParticipants: Participant[]) => {
    setParticipants(prev => {
      // Merge unique by email/ticketNumber
      const existingEmails = new Set(prev.map(p => p.email.toLowerCase()));
      const filtered = newParticipants.filter(p => !existingEmails.has(p.email.toLowerCase()));
      return [...filtered, ...prev];
    });

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  };

  const importSessions = (newSessions: Session[]) => {
    setSessions(prev => {
      const existingTitles = new Set(prev.map(s => s.title.toLowerCase()));
      const filtered = newSessions.filter(s => !existingTitles.has(s.title.toLowerCase()));
      return [...prev, ...filtered];
    });

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  };

  const importAnnouncements = (newAnnouncements: Announcement[]) => {
    setAnnouncements(prev => [...newAnnouncements, ...prev]);
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.5 }
      });
    } catch (e) {}
  };

  // Super-Admin Configuration Update
  const updateEventConfig = (updated: Partial<EventConfig>) => {
    setEventConfig(prev => ({ ...prev, ...updated }));
  };

  // Super-Admin Session CRUD
  const addSession = (sessionData: Omit<Session, 'id' | 'currentAttendees'>) => {
    const newSession: Session = {
      ...sessionData,
      id: `ses-${Date.now()}`,
      currentAttendees: 0
    };
    setSessions(prev => [...prev, newSession]);
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
    } catch (e) {}
  };

  const updateSession = (sessionId: string, updated: Partial<Session>) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updated } : s));
  };

  const deleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setSavedSessionIds(prev => prev.filter(id => id !== sessionId));
  };

  // Super-Admin Participant CRUD
  const addParticipant = (participantData: Omit<Participant, 'id' | 'ticketNumber' | 'checkedInSessions'>): Participant => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const newParticipant: Participant = {
      ...participantData,
      id: `usr-${Date.now().toString().slice(-4)}`,
      ticketNumber: `INDABAX-BJ-2026-${randomNum}`,
      checkedInSessions: []
    };
    setParticipants(prev => [newParticipant, ...prev]);
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
    } catch (e) {}
    return newParticipant;
  };

  const updateParticipant = (participantId: string, updated: Partial<Participant>) => {
    setParticipants(prev => prev.map(p => {
      if (p.id === participantId) {
        const updatedUser = { ...p, ...updated };
        if (currentUser.id === participantId) {
          setCurrentUser(updatedUser);
        }
        return updatedUser;
      }
      return p;
    }));
  };

  const deleteParticipant = (participantId: string) => {
    setParticipants(prev => prev.filter(p => p.id !== participantId));
  };

  // Super-Admin Announcement CRUD
  const updateAnnouncement = (announcementId: string, updated: Partial<Announcement>) => {
    setAnnouncements(prev => prev.map(a => a.id === announcementId ? { ...a, ...updated } : a));
  };

  const deleteAnnouncement = (announcementId: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
  };

  const togglePinAnnouncement = (announcementId: string) => {
    setAnnouncements(prev => prev.map(a => a.id === announcementId ? { ...a, pinned: !a.pinned } : a));
  };

  // Super-Admin Chat Channel CRUD
  const addChannel = (channelData: Omit<ChatChannel, 'id' | 'memberCount'>) => {
    const newChannel: ChatChannel = {
      ...channelData,
      id: `chan-${Date.now()}`,
      memberCount: participants.length || 45
    };
    setChannels(prev => [...prev, newChannel]);
    try {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.5 } });
    } catch (e) {}
  };

  const deleteChannel = (channelId: string) => {
    setChannels(prev => prev.filter(c => c.id !== channelId));
  };

  // Super-Admin Full Database Backup (JSON)
  const exportFullDatabaseJson = () => {
    const fullBackup = {
      meta: {
        appName: "IndabaX Bénin 2026 Management Platform",
        version: "3.0.0",
        exportDate: new Date().toISOString(),
        exportedBy: currentUser.name
      },
      eventConfig,
      sessions,
      participants,
      checkIns,
      feedbacks,
      announcements,
      channels,
      chatMessages,
      speakerResources,
      volunteerLogs
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `indabax-benin-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Super-Admin Restore Database from JSON
  const importFullDatabaseJson = (jsonData: any): { success: boolean; message: string } => {
    try {
      if (!jsonData || typeof jsonData !== 'object') {
        return { success: false, message: "Format de fichier JSON invalide." };
      }

      if (Array.isArray(jsonData.sessions)) setSessions(jsonData.sessions);
      if (Array.isArray(jsonData.participants)) setParticipants(jsonData.participants);
      if (Array.isArray(jsonData.checkIns)) setCheckIns(jsonData.checkIns);
      if (Array.isArray(jsonData.feedbacks)) setFeedbacks(jsonData.feedbacks);
      if (Array.isArray(jsonData.announcements)) setAnnouncements(jsonData.announcements);
      if (Array.isArray(jsonData.channels)) setChannels(jsonData.channels);
      if (Array.isArray(jsonData.chatMessages)) setChatMessages(jsonData.chatMessages);
      if (Array.isArray(jsonData.speakerResources)) setSpeakerResources(jsonData.speakerResources);
      if (Array.isArray(jsonData.volunteerLogs)) setVolunteerLogs(jsonData.volunteerLogs);
      if (jsonData.eventConfig) setEventConfig(jsonData.eventConfig);

      try {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      } catch (e) {}

      return {
        success: true,
        message: `Restauration effectuée avec succès (${jsonData.sessions?.length || 0} sessions, ${jsonData.participants?.length || 0} participants).`
      };
    } catch (err: any) {
      return { success: false, message: "Erreur lors de la restauration: " + err.message };
    }
  };

  // Reset to Factory Default Data
  const resetToDefaultData = () => {
    setSessions(INITIAL_SESSIONS);
    setParticipants(INITIAL_PARTICIPANTS);
    setCheckIns(INITIAL_CHECKINS);
    setFeedbacks(INITIAL_FEEDBACKS);
    setAnnouncements(INITIAL_ANNOUNCEMENTS);
    setChannels(INITIAL_CHANNELS);
    setChatMessages(INITIAL_CHAT_MESSAGES);
    setSpeakerResources(INITIAL_SPEAKER_RESOURCES);
    setVolunteerLogs(INITIAL_VOLUNTEER_LOGS);
    setEventConfig(INITIAL_EVENT_CONFIG);
    setSavedSessionIds(['ses-101', 'ses-201', 'ses-202']);
    setCurrentUser(INITIAL_PARTICIPANTS[0]);

    localStorage.removeItem('indabax_sessions');
    localStorage.removeItem('indabax_participants');
    localStorage.removeItem('indabax_checkins');
    localStorage.removeItem('indabax_feedbacks');
    localStorage.removeItem('indabax_announcements');
    localStorage.removeItem('indabax_channels');
    localStorage.removeItem('indabax_chat_messages');
    localStorage.removeItem('indabax_speaker_resources');
    localStorage.removeItem('indabax_volunteer_logs');
    localStorage.removeItem('indabax_event_config');
    localStorage.removeItem('indabax_saved_sessions');
  };

  // Batch Export CSV Bundle
  const exportAllCsvBundle = () => {
    exportToCsv('participants');
    setTimeout(() => exportToCsv('sessions'), 300);
    setTimeout(() => exportToCsv('checkins'), 600);
    setTimeout(() => exportToCsv('feedbacks'), 900);
    setTimeout(() => exportToCsv('announcements'), 1200);
    setTimeout(() => exportToCsv('logs'), 1500);
  };

  // Download Sample CSV Templates
  const downloadTemplateCsv = (type: 'participants' | 'sessions' | 'announcements') => {
    let csvContent = "data:text/csv;charset=utf-8,";
    let filename = `modele_${type}_indabax.csv`;

    if (type === 'participants') {
      csvContent += "name,email,role,institution,position,country,city,bio,interests\n";
      csvContent += '"Dr. Samuel Dossou","samuel.dossou@uac.bj","speaker","Université d\'Abomey-Calavi","Maître de Conférences","Bénin","Cotonou","Chercheur en vision par ordinateur et modèles génératifs","Computer Vision;Generative AI;Santé"\n';
      csvContent += '"Aïchatou Kouassi","aichatou.k@gmail.com","attendee","IFRI UAC","Étudiante Master IA","Bénin","Abomey-Calavi","Passionnée par le NLP et la traduction automatique Fongbe","NLP;Fondamentaux ML;PyTorch"\n';
    } else if (type === 'sessions') {
      csvContent += "title,speaker,speakerTitle,speakerInstitution,day,date,startTime,endTime,room,track,type,level,capacity,description\n";
      csvContent += '"Atelier LLMs Multilingues Africains","Dr. Kevin Gbaguidi","AI Research Lead","Benin AI Labs",2,"2026-09-19","10:00","12:00","Lab IA - Salle Turing","Generative AI & LLMs","Workshop","Intermédiaire",60,"Fine-tuning de modèles ouverts sur des corpus Fongbe, Yoruba et Baatonum."\n';
    } else if (type === 'announcements') {
      csvContent += "title,category,priority,content,targetAudience\n";
      csvContent += '"Navettes gratuites Cotonou - UAC Calavi","LOGISTIQUE","high","Des bus dédiés IndabaX partent du Palais des Congrès à 07h30 et 08h15 chaque matin.","all"\n';
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <EventContext.Provider value={{
      currentUser,
      setCurrentUser,
      sessions,
      participants,
      checkIns,
      feedbacks,
      connections,
      savedSessionIds,
      activeTab,
      setActiveTab,
      selectedDay,
      setSelectedDay,
      searchQuery,
      setSearchQuery,
      selectedTrack,
      setSelectedTrack,
      authStatus,
      authSession,
      authWarning,
      isAuthenticating,
      signInWithEmail,
      signOut,
      changeMyPassword,
      realRole,
      effectiveRole,
      capabilities,
      previewRole,
      setPreviewRole,
      refreshMyRole,
      userAccounts,
      assignRole,
      setAccountStatus,
      removeAccount,
      refreshAccounts,
      reloadAccountsFromSheet,
      sheetsConfig,
      saveSheetsSettings,
      isSheetsLinked,
      canWriteToSheets,
      linkSheetsDatabase,
      unlinkSheetsDatabase,
      importFromSheets,
      pushDataToSheets,
      isSyncing,
      docLinks,
      visibleDocLinks,
      saveDocLink,
      removeDocLink,
      theme,
      toggleTheme,
      activeAlerts,
      dismissAlert,
      testPushNotification,
      notificationPermission,
      requestNotificationPermission,
      isSheetsSetupOpen,
      setIsSheetsSetupOpen,
      isScannerOpen,
      scannerTargetSession,
      openScanner,
      closeScanner,
      isImportModalOpen,
      setIsImportModalOpen,
      eventConfig,
      updateEventConfig,
      announcements,
      channels,
      chatMessages,
      speakerResources,
      volunteerLogs,
      activeChannelId,
      setActiveChannelId,
      activeDirectPartnerId,
      setActiveDirectPartnerId,
      addSession,
      updateSession,
      deleteSession,
      addParticipant,
      updateParticipant,
      deleteParticipant,
      updateAnnouncement,
      deleteAnnouncement,
      togglePinAnnouncement,
      addChannel,
      deleteChannel,
      checkInParticipant,
      submitFeedback,
      updateUserProfile,
      addConnection,
      toggleSaveSession,
      exportToCsv,
      addSessionToCalendar,
      syncAllSavedSessionsToGoogleCalendar,
      downloadAllSavedSessionsIcs,
      importParticipants,
      importSessions,
      importAnnouncements,
      exportFullDatabaseJson,
      importFullDatabaseJson,
      resetToDefaultData,
      exportAllCsvBundle,
      downloadTemplateCsv,
      addAnnouncement,
      likeAnnouncement,
      addAnnouncementComment,
      sendChannelMessage,
      sendDirectMessage,
      reactToMessage,
      addSpeakerResource,
      addVolunteerLog,
      resolveVolunteerLog
    }}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => {
  const context = useContext(EventContext);
  if (!context) throw new Error('useEvent must be used within an EventProvider');
  return context;
};

