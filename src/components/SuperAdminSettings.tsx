import React, { useState } from 'react';
import { useEvent } from '../context/EventContext';
import {
  Settings,
  Calendar,
  Users,
  Bell,
  MessageSquare,
  Database,
  Cloud,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Save,
  FileSpreadsheet,
  ShieldCheck,
  Sliders,
  MapPin,
  Sparkles,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  Flame,
  Info
} from 'lucide-react';
import {
  Session,
  Participant,
  Announcement,
  ChatChannel,
  SessionTrack,
  SessionType,
  ParticipantRole,
  AnnouncementCategory,
  RoomConfig
} from '../types';

export const SuperAdminSettings: React.FC = () => {
  const {
    eventConfig,
    updateEventConfig,
    sessions,
    addSession,
    updateSession,
    deleteSession,
    participants,
    addParticipant,
    updateParticipant,
    deleteParticipant,
    announcements,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    togglePinAnnouncement,
    channels,
    addChannel,
    deleteChannel,
    checkIns,
    feedbacks,
    volunteerLogs,
    sheetsConfig,
    isSheetsLinked,
    canWriteToSheets,
    isSyncing,
    linkSheetsDatabase,
    unlinkSheetsDatabase,
    pushDataToSheets,
    importFromSheets,
    reloadAccountsFromSheet,
    userAccounts,
    exportToCsv,
    exportFullDatabaseJson,
    importFullDatabaseJson,
    resetToDefaultData,
    exportAllCsvBundle,
    downloadTemplateCsv,
    setIsImportModalOpen,
    setIsSheetsSetupOpen,
    currentUser
  } = useEvent();

  // Retour des actions liees au classeur (liaison, import, envoi)
  const [sheetsMessage, setSheetsMessage] = useState<string | null>(null);

  const runSheetsAction = async (action: () => Promise<string>) => {
    try {
      setSheetsMessage(await action());
    } catch (error: any) {
      setSheetsMessage(error?.message || 'Opération impossible.');
    }
    setTimeout(() => setSheetsMessage(null), 6000);
  };

  // Active Admin Sub-tab
  const [activeAdminTab, setActiveAdminTab] = useState<'general' | 'sessions' | 'participants' | 'communications' | 'data' | 'integrations'>('general');

  // Form State for Event Config
  const [generalForm, setGeneralForm] = useState(eventConfig);
  const [hasUnsavedGeneral, setHasUnsavedGeneral] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Modal / Editor States for Sessions
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionDayFilter, setSessionDayFilter] = useState<number | 'all'>('all');
  const [sessionTrackFilter, setSessionTrackFilter] = useState<string>('all');

  // Modal / Editor States for Participants
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [isNewParticipantModalOpen, setIsNewParticipantModalOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantRoleFilter, setParticipantRoleFilter] = useState<string>('all');

  // Modal / Editor States for Announcements
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isNewAnnouncementModalOpen, setIsNewAnnouncementModalOpen] = useState(false);

  // Modal / States for Chat Channels
  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({ name: '', slug: '', description: '', iconName: 'MessageSquare' });

  // Danger Zone confirmation
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // JSON Restore Input
  const [jsonInputString, setJsonInputString] = useState('');
  const [jsonRestoreError, setJsonRestoreError] = useState('');
  const [jsonRestoreSuccess, setJsonRestoreSuccess] = useState('');

  // Available tracks & types
  const ALL_TRACKS: SessionTrack[] = [
    'NLP & Langues Africaines',
    'Computer Vision & Santé',
    'Fondamentaux ML',
    'Generative AI & LLMs',
    'Entrepreneuriat & Éthique',
    'Keynote'
  ];

  const ALL_TYPES: SessionType[] = [
    'Keynote',
    'Workshop',
    'Paper Presentation',
    'Panel',
    'Hackathon',
    'Networking'
  ];

  const ALL_ROLES: { value: ParticipantRole; label: string; color: string }[] = [
    { value: 'super-admin', label: 'Super-Admin', color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900' },
    { value: 'organizer', label: 'Organisateur', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900' },
    { value: 'speaker', label: 'Conférencier', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900' },
    { value: 'volunteer', label: 'Volontaire', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900' },
    { value: 'attendee', label: 'Participant', color: 'bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800' },
    { value: 'sponsor', label: 'Sponsor', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900' }
  ];

  // Save General Configuration
  const handleSaveGeneralConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateEventConfig(generalForm);
    setHasUnsavedGeneral(false);
    setSaveSuccessMsg('Configuration de l\'événement enregistrée avec succès !');
    setTimeout(() => setSaveSuccessMsg(''), 3500);
  };

  // Add Room to Event Config
  const handleAddRoom = () => {
    const newRoom: RoomConfig = {
      id: `room-${Date.now()}`,
      name: 'Nouvelle Salle',
      capacity: 50,
      locationNotes: 'Étage / Bâtiment',
      hasStream: false
    };
    const updatedRooms = [...(generalForm.rooms || []), newRoom];
    setGeneralForm({ ...generalForm, rooms: updatedRooms });
    setHasUnsavedGeneral(true);
  };

  const handleUpdateRoom = (roomId: string, field: keyof RoomConfig, value: any) => {
    const updatedRooms = generalForm.rooms.map(r => r.id === roomId ? { ...r, [field]: value } : r);
    setGeneralForm({ ...generalForm, rooms: updatedRooms });
    setHasUnsavedGeneral(true);
  };

  const handleDeleteRoom = (roomId: string) => {
    const updatedRooms = generalForm.rooms.filter(r => r.id !== roomId);
    setGeneralForm({ ...generalForm, rooms: updatedRooms });
    setHasUnsavedGeneral(true);
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(sessionSearch.toLowerCase()) ||
                          s.speaker.toLowerCase().includes(sessionSearch.toLowerCase()) ||
                          s.room.toLowerCase().includes(sessionSearch.toLowerCase());
    const matchesDay = sessionDayFilter === 'all' || s.day === sessionDayFilter;
    const matchesTrack = sessionTrackFilter === 'all' || s.track === sessionTrackFilter;
    return matchesSearch && matchesDay && matchesTrack;
  });

  // Filtered Participants
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
                          p.email.toLowerCase().includes(participantSearch.toLowerCase()) ||
                          p.ticketNumber.toLowerCase().includes(participantSearch.toLowerCase()) ||
                          p.institution.toLowerCase().includes(participantSearch.toLowerCase());
    const matchesRole = participantRoleFilter === 'all' || p.role === participantRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Handle JSON Restore
  const handleRestoreJsonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJsonRestoreError('');
    setJsonRestoreSuccess('');

    try {
      const parsed = JSON.parse(jsonInputString);
      const res = importFullDatabaseJson(parsed);
      if (res.success) {
        setJsonRestoreSuccess(res.message);
        setJsonInputString('');
      } else {
        setJsonRestoreError(res.message);
      }
    } catch (err: any) {
      setJsonRestoreError("Erreur d'analyse JSON : format invalide (" + err.message + ")");
    }
  };

  const handleRestoreFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setJsonInputString(text);
        const parsed = JSON.parse(text);
        const res = importFullDatabaseJson(parsed);
        if (res.success) {
          setJsonRestoreSuccess(res.message);
        } else {
          setJsonRestoreError(res.message);
        }
      } catch (err: any) {
        setJsonRestoreError("Impossible de lire ce fichier JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">

      {/* Top Header & Super-Admin Badging */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl -mb-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Console Super-Administrateur & Paramètres Système</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              Administration & Gestion des Données
            </h1>
            <p className="text-stone-300 text-sm leading-relaxed">
              Supervisez l'intégralité d'<strong>{eventConfig.eventName} {eventConfig.edition}</strong> : configurez les paramètres généraux, modifiez directement les programmes et accréditations, gérez les flux d'import/export et surveillez la synchronisation avec le classeur Google Sheet.
            </p>
          </div>

          {/* Key Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[10px] text-stone-300 uppercase font-bold block">Sessions</span>
              <span className="text-xl font-black text-amber-300">{sessions.length}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[10px] text-stone-300 uppercase font-bold block">Participants</span>
              <span className="text-xl font-black text-emerald-300">{participants.length}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[10px] text-stone-300 uppercase font-bold block">Émargements</span>
              <span className="text-xl font-black text-sky-300">{checkIns.length}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[10px] text-stone-300 uppercase font-bold block">Feedbacks</span>
              <span className="text-xl font-black text-purple-300">{feedbacks.length}</span>
            </div>
          </div>
        </div>

        {/* Global Quick Action Toolbar */}
        <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-stone-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connecté en tant que <strong>{currentUser.name}</strong> ({currentUser.role})</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-amber-300" />
              <span>Importation Rapide CSV/JSON</span>
            </button>
            <button
              onClick={exportFullDatabaseJson}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              title="Télécharge une sauvegarde JSON complète de toutes les données"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sauvegarder Tout (JSON)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Admin Tab Navigation Bar */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-1.5 shadow-xs flex items-center gap-1 overflow-x-auto scrollbar-none transition-colors">
        <button
          onClick={() => setActiveAdminTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeAdminTab === 'general'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>1. Configuration Événement</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeAdminTab === 'sessions'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>2. Gestion Programme & Sessions</span>
          <span className="px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-700 text-[10px]">
            {sessions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('participants')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeAdminTab === 'participants'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>3. Participants & Rôles</span>
          <span className="px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-700 text-[10px]">
            {participants.length}
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('communications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeAdminTab === 'communications'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>4. Annonces & Salons</span>
          <span className="px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-700 text-[10px]">
            {announcements.length}
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('data')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeAdminTab === 'data'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>5. Imports, Exports & Sauvegardes</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('integrations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeAdminTab === 'integrations'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>6. Base Google Sheet</span>
          {isSheetsLinked && (
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          )}
        </button>
      </div>

      {/* TAB 1: GENERAL EVENT CONFIGURATION */}
      {activeAdminTab === 'general' && (
        <div className="space-y-6">
          {saveSuccessMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm font-semibold">{saveSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveGeneralConfig} className="space-y-6">

            {/* Event Basic Info Card */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-600 dark:text-amber-400">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                      Identité & Coordonnées de l'Événement
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Informations officielles publiées sur les badges, exports et dans l'interface.
                    </p>
                  </div>
                </div>

                {hasUnsavedGeneral && (
                  <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold animate-pulse">
                    Modifications non enregistrées
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    Nom de l'événement
                  </label>
                  <input
                    type="text"
                    value={generalForm.eventName}
                    onChange={(e) => { setGeneralForm({ ...generalForm, eventName: e.target.value }); setHasUnsavedGeneral(true); }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    Édition
                  </label>
                  <input
                    type="text"
                    value={generalForm.edition}
                    onChange={(e) => { setGeneralForm({ ...generalForm, edition: e.target.value }); setHasUnsavedGeneral(true); }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    Email de contact organisateur
                  </label>
                  <input
                    type="email"
                    value={generalForm.contactEmail}
                    onChange={(e) => { setGeneralForm({ ...generalForm, contactEmail: e.target.value }); setHasUnsavedGeneral(true); }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={generalForm.startDate}
                    onChange={(e) => { setGeneralForm({ ...generalForm, startDate: e.target.value }); setHasUnsavedGeneral(true); }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={generalForm.endDate}
                    onChange={(e) => { setGeneralForm({ ...generalForm, endDate: e.target.value }); setHasUnsavedGeneral(true); }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    Ville & Pays
                  </label>
                  <input
                    type="text"
                    value={generalForm.location}
                    onChange={(e) => { setGeneralForm({ ...generalForm, location: e.target.value }); setHasUnsavedGeneral(true); }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                    required
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    Lieu & Adresse principale
                  </label>
                  <input
                    type="text"
                    value={generalForm.venueAddress}
                    onChange={(e) => { setGeneralForm({ ...generalForm, venueAddress: e.target.value }); setHasUnsavedGeneral(true); }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                    required
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    Thématique & Description de l'édition
                  </label>
                  <textarea
                    rows={2}
                    value={generalForm.themeDescription}
                    onChange={(e) => { setGeneralForm({ ...generalForm, themeDescription: e.target.value }); setHasUnsavedGeneral(true); }}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Rooms Management Card */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4 transition-colors">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                      Salles, Amphithéâtres & Capacités d'Accueil
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Définit les jauges maximales pour le calcul automatique des taux de remplissage.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddRoom}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une Salle</span>
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {generalForm.rooms.map((room, idx) => (
                  <div
                    key={room.id || idx}
                    className="p-3.5 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">Nom de la salle</label>
                        <input
                          type="text"
                          value={room.name}
                          onChange={(e) => handleUpdateRoom(room.id, 'name', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-xl text-xs font-bold text-stone-900 dark:text-stone-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">Capacité maximale (places)</label>
                        <input
                          type="number"
                          min="5"
                          value={room.capacity}
                          onChange={(e) => handleUpdateRoom(room.id, 'capacity', parseInt(e.target.value) || 50)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-xl text-xs font-bold text-stone-900 dark:text-stone-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">Localisation / Notes</label>
                        <input
                          type="text"
                          value={room.locationNotes || ''}
                          onChange={(e) => handleUpdateRoom(room.id, 'locationNotes', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100"
                          placeholder="Ex: Étage 1, Bâtiment Central"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={room.hasStream || false}
                          onChange={(e) => handleUpdateRoom(room.id, 'hasStream', e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Streaming Live</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(room.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                        title="Supprimer la salle"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Functional Toggle Options */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4 transition-colors">
              <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                Options Fonctionnelles & Règles Système
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">Inscriptions Express sur Site</h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">Autoriser l'émargement automatique de nouveaux emails scannés.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={generalForm.allowExpressRegistration}
                    onChange={(e) => { setGeneralForm({ ...generalForm, allowExpressRegistration: e.target.checked }); setHasUnsavedGeneral(true); }}
                    className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400"
                  />
                </div>

                <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">Alertes Push 15 min</h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">Déclencher les notifications avant chaque session de l'agenda.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={generalForm.sessionReminderMinutes > 0}
                    onChange={(e) => { setGeneralForm({ ...generalForm, sessionReminderMinutes: e.target.checked ? 15 : 0 }); setHasUnsavedGeneral(true); }}
                    className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400"
                  />
                </div>

                <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">Feedbacks Anonymes</h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">Permettre aux auditeurs d'évaluer les sessions sans afficher leur nom.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={generalForm.enableAnonymousFeedback}
                    onChange={(e) => { setGeneralForm({ ...generalForm, enableAnonymousFeedback: e.target.checked }); setHasUnsavedGeneral(true); }}
                    className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400"
                  />
                </div>

                <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">Mode Maintenance</h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">Afficher une bannière d'information lors des mises à jour majeures.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={generalForm.maintenanceMode}
                    onChange={(e) => { setGeneralForm({ ...generalForm, maintenanceMode: e.target.checked }); setHasUnsavedGeneral(true); }}
                    className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Save Buttons Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setGeneralForm(eventConfig); setHasUnsavedGeneral(false); }}
                className="px-5 py-2.5 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-2xl font-bold text-sm transition cursor-pointer"
              >
                Annuler les modifications
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black rounded-2xl shadow-lg flex items-center gap-2 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer la Configuration</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: CONTENT MANAGEMENT - SESSIONS */}
      {activeAdminTab === 'sessions' && (
        <div className="space-y-5">
          {/* Header Action Bar */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-colors">
            <div className="flex-1 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher une session, speaker, salle..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                />
              </div>

              {/* Day Filter */}
              <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setSessionDayFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    sessionDayFilter === 'all' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs' : 'text-stone-500'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setSessionDayFilter(1)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    sessionDayFilter === 1 ? 'bg-amber-500 text-stone-950 font-black shadow-2xs' : 'text-stone-500'
                  }`}
                >
                  Jour 1
                </button>
                <button
                  onClick={() => setSessionDayFilter(2)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    sessionDayFilter === 2 ? 'bg-amber-500 text-stone-950 font-black shadow-2xs' : 'text-stone-500'
                  }`}
                >
                  Jour 2
                </button>
                <button
                  onClick={() => setSessionDayFilter(3)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    sessionDayFilter === 3 ? 'bg-amber-500 text-stone-950 font-black shadow-2xs' : 'text-stone-500'
                  }`}
                >
                  Jour 3
                </button>
              </div>

              {/* Track Filter */}
              <select
                value={sessionTrackFilter}
                onChange={(e) => setSessionTrackFilter(e.target.value)}
                className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              >
                <option value="all">Toutes les thématiques</option>
                {ALL_TRACKS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadTemplateCsv('sessions')}
                className="px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Télécharger le modèle CSV de session"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Modèle CSV</span>
              </button>

              <button
                onClick={() => setIsNewSessionModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Créer une Session</span>
              </button>
            </div>
          </div>

          {/* Sessions Table / Cards */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl overflow-hidden shadow-xs transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Date & Horaire</th>
                    <th className="py-3 px-4">Session & Intervenant</th>
                    <th className="py-3 px-4">Salle & Thématique</th>
                    <th className="py-3 px-4 text-center">Type / Niveau</th>
                    <th className="py-3 px-4 text-center">Inscrits / Jauge</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-500 font-semibold">
                        Aucune session ne correspond à vos critères.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((ses) => {
                      const occupancyRate = Math.round((ses.currentAttendees / ses.capacity) * 100);
                      return (
                        <tr key={ses.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-amber-600 dark:text-amber-400 block">Jour {ses.day} ({ses.date.slice(5)})</span>
                            <span className="text-stone-500 dark:text-stone-400 text-[11px]">{ses.startTime} - {ses.endTime}</span>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <h4 className="font-bold text-stone-900 dark:text-stone-100 line-clamp-1">{ses.title}</h4>
                            <p className="text-stone-500 dark:text-stone-400 text-[11px] line-clamp-1">
                              <strong>{ses.speaker}</strong> • {ses.speakerInstitution}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-semibold text-stone-800 dark:text-stone-200 block">{ses.room}</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[10px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                              {ses.track}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-[10px] block mb-0.5">
                              {ses.type}
                            </span>
                            <span className="text-[10px] text-stone-500">{ses.level}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="font-bold text-stone-900 dark:text-stone-100">{ses.currentAttendees} / {ses.capacity}</span>
                            <div className="w-16 mx-auto bg-stone-200 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full ${occupancyRate >= 90 ? 'bg-red-500' : occupancyRate >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingSession(ses)}
                                className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                                title="Modifier la session"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Confirmez-vous la suppression de la session "${ses.title}" ?`)) {
                                    deleteSession(ses.id);
                                  }
                                }}
                                className="p-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-lg transition cursor-pointer"
                                title="Supprimer la session"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONTENT MANAGEMENT - PARTICIPANTS */}
      {activeAdminTab === 'participants' && (
        <div className="space-y-5">
          {/* Action Bar */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-colors">
            <div className="flex-1 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email, billet, institution..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                />
              </div>

              {/* Role filter */}
              <select
                value={participantRoleFilter}
                onChange={(e) => setParticipantRoleFilter(e.target.value)}
                className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              >
                <option value="all">Tous les rôles ({participants.length})</option>
                {ALL_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadTemplateCsv('participants')}
                className="px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Télécharger le modèle CSV de participants"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Modèle CSV</span>
              </button>

              <button
                onClick={() => setIsNewParticipantModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Participant</span>
              </button>
            </div>
          </div>

          {/* Participants Table */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl overflow-hidden shadow-xs transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Participant & Contact</th>
                    <th className="py-3 px-4">N° Billet</th>
                    <th className="py-3 px-4">Rôle & Permissions</th>
                    <th className="py-3 px-4">Institution & Ville</th>
                    <th className="py-3 px-4 text-center">Émargements</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-500 font-semibold">
                        Aucun participant trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((part) => {
                      const roleConfig = ALL_ROLES.find(r => r.value === part.role) || ALL_ROLES[4];
                      return (
                        <tr key={part.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={part.avatarUrl}
                                alt={part.name}
                                className="w-8 h-8 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                              />
                              <div>
                                <h4 className="font-bold text-stone-900 dark:text-stone-100">{part.name}</h4>
                                <span className="text-stone-500 dark:text-stone-400 text-[11px]">{part.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono text-[11px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700">
                              {part.ticketNumber}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <select
                              value={part.role}
                              onChange={(e) => updateParticipant(part.id, { role: e.target.value as ParticipantRole })}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border cursor-pointer focus:outline-hidden ${roleConfig.color}`}
                            >
                              {ALL_ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-stone-800 dark:text-stone-200 block line-clamp-1">{part.institution}</span>
                            <span className="text-stone-500 text-[11px]">{part.city || 'Cotonou'}, {part.country || 'Bénin'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                              {part.checkedInSessions?.length || 0} validé(s)
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingParticipant(part)}
                                className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                                title="Modifier le profil"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Confirmez-vous la suppression du participant "${part.name}" (${part.email}) ?`)) {
                                    deleteParticipant(part.id);
                                  }
                                }}
                                className="p-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-lg transition cursor-pointer"
                                title="Supprimer le participant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONTENT MANAGEMENT - COMMUNICATIONS (ANNOUNCEMENTS & CHAT CHANNELS) */}
      {activeAdminTab === 'communications' && (
        <div className="space-y-6">

          {/* Announcements Management Card */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5 transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-600 dark:text-amber-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                    Communiqués & Annonces Officielles ({announcements.length})
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Diffusez des alertes en direct, épinglez les messages urgents et modifiez les communiqués.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadTemplateCsv('announcements')}
                  className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Modèle CSV</span>
                </button>

                <button
                  onClick={() => setIsNewAnnouncementModalOpen(true)}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle Annonce</span>
                </button>
              </div>
            </div>

            {/* List of Announcements */}
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start justify-between gap-3 ${
                    ann.pinned
                      ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900'
                      : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ann.pinned && (
                        <span className="px-2 py-0.5 bg-amber-400 text-stone-950 rounded text-[10px] font-black uppercase">
                          Épinglé
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded text-[10px] font-bold">
                        {ann.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ann.priority === 'urgent' ? 'bg-red-500 text-white' : ann.priority === 'high' ? 'bg-orange-500 text-white' : 'bg-stone-200 text-stone-700'
                      }`}>
                        Priorité {ann.priority}
                      </span>
                      <span className="text-[11px] text-stone-400">
                        {new Date(ann.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">{ann.title}</h4>
                    <p className="text-xs text-stone-600 dark:text-stone-300">{ann.content}</p>
                    <div className="text-[11px] text-stone-400 pt-1">
                      Par <strong>{ann.authorName}</strong> • {ann.likes} like(s) • {ann.comments?.length || 0} commentaire(s)
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => togglePinAnnouncement(ann.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        ann.pinned ? 'bg-amber-400 text-stone-950' : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {ann.pinned ? 'Désépingler' : 'Épingler'}
                    </button>
                    <button
                      onClick={() => setEditingAnnouncement(ann)}
                      className="p-1.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-800 dark:text-stone-200 rounded-xl transition cursor-pointer"
                      title="Modifier"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Supprimer définitivement ce communiqué ?')) {
                          deleteAnnouncement(ann.id);
                        }
                      }}
                      className="p-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 hover:bg-red-100 rounded-xl transition cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Channels Management Card */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5 transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                    Salons de Discussion Communautaires ({channels.length})
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Créez des salons thématiques pour les échanges entre conférenciers, auditeurs et équipes.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsNewChannelModalOpen(true)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Salon</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {channels.map((chan) => (
                <div
                  key={chan.id}
                  className="p-4 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-2xl flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <span className="text-indigo-600 dark:text-indigo-400 font-black">#</span>
                      <span>{chan.name}</span>
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2">{chan.description}</p>
                    <span className="text-[10px] text-stone-400 block pt-1">
                      {chan.memberCount || participants.length} membres
                    </span>
                  </div>

                  {chan.id !== 'chan-general' && (
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer le salon #${chan.name} ?`)) {
                          deleteChannel(chan.id);
                        }
                      }}
                      className="p-1 text-red-400 hover:text-red-600 rounded transition cursor-pointer shrink-0"
                      title="Supprimer le salon"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DATA HUB - IMPORTS, EXPORTS & BACKUPS */}
      {activeAdminTab === 'data' && (
        <div className="space-y-6">

          {/* Quick Export Hub */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                  Centre d'Exportation & Téléchargements
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Exportez l'ensemble des données dans des formats standards (JSON complet pour sauvegarde, CSV pour tableurs).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Full JSON Backup */}
              <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-300 dark:border-amber-900 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-900 dark:text-amber-300">Sauvegarde JSON Intégrale</span>
                  <span className="px-2 py-0.5 bg-amber-400 text-stone-950 rounded text-[9px] font-black uppercase">Recommandé</span>
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-400">
                  Exporte toutes les tables (sessions, participants, checkins, feedbacks, annonces, logs, config).
                </p>
                <button
                  onClick={exportFullDatabaseJson}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter Base Complète (.json)</span>
                </button>
              </div>

              {/* CSV Bundle */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-2xl space-y-2.5">
                <span className="font-bold text-xs text-stone-900 dark:text-stone-100 block">Pack CSV Global</span>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Déclenche le téléchargement automatique de tous les fichiers CSV (Présences, Feedbacks, Sessions, etc.).
                </p>
                <button
                  onClick={exportAllCsvBundle}
                  className="w-full py-2 bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Télécharger Pack CSV</span>
                </button>
              </div>

              {/* Check-ins CSV */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-2xl space-y-2.5">
                <span className="font-bold text-xs text-stone-900 dark:text-stone-100 block">Émargements / Présences ({checkIns.length})</span>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Historique complet des scans QR, dates précises, opérateurs et sessions associées.
                </p>
                <button
                  onClick={() => exportToCsv('checkins')}
                  className="w-full py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-800 dark:text-stone-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter Émargements (.csv)</span>
                </button>
              </div>

              {/* Feedbacks CSV */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-2xl space-y-2.5">
                <span className="font-bold text-xs text-stone-900 dark:text-stone-100 block">Évaluations & Notes ({feedbacks.length})</span>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Notes détaillées de 1 à 5, clarté des intervenants, retours qualitatifs et questions orateurs.
                </p>
                <button
                  onClick={() => exportToCsv('feedbacks')}
                  className="w-full py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-800 dark:text-stone-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter Feedbacks (.csv)</span>
                </button>
              </div>

              {/* Participants CSV */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-2xl space-y-2.5">
                <span className="font-bold text-xs text-stone-900 dark:text-stone-100 block">Participants ({participants.length})</span>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Listing des inscrits avec billets, institutions, rôles et centres d'intérêts.
                </p>
                <button
                  onClick={() => exportToCsv('participants')}
                  className="w-full py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-800 dark:text-stone-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter Participants (.csv)</span>
                </button>
              </div>

              {/* Sessions CSV */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-2xl space-y-2.5">
                <span className="font-bold text-xs text-stone-900 dark:text-stone-100 block">Programme & Sessions ({sessions.length})</span>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Horaires, intervenants, salles, tracks, types et jauges de participation.
                </p>
                <button
                  onClick={() => exportToCsv('sessions')}
                  className="w-full py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-800 dark:text-stone-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter Programme (.csv)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Restore JSON Backup Card */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 rounded-2xl text-purple-600 dark:text-purple-400">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                  Restauration de Sauvegarde JSON
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Chargez un fichier de sauvegarde pour restaurer l'état exact de l'événement.
                </p>
              </div>
            </div>

            {jsonRestoreSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{jsonRestoreSuccess}</span>
              </div>
            )}

            {jsonRestoreError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{jsonRestoreError}</span>
              </div>
            )}

            <form onSubmit={handleRestoreJsonSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="w-full sm:w-auto px-4 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-stone-200 dark:border-stone-700 transition">
                  <Upload className="w-4 h-4 text-purple-500" />
                  <span>Sélectionner Fichier .JSON</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-stone-400">ou collez directement le contenu ci-dessous :</span>
              </div>

              <textarea
                rows={3}
                placeholder="Collez ici le JSON complet de sauvegarde..."
                value={jsonInputString}
                onChange={(e) => setJsonInputString(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-purple-400 focus:outline-hidden"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!jsonInputString.trim()}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restaurer les Données</span>
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone: Factory Reset */}
          <div className="bg-red-500/5 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-3xl p-6 sm:p-7 space-y-4 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 rounded-2xl text-red-600 dark:text-red-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-red-900 dark:text-red-300">
                  Zone de Danger : Réinitialisation Usine
                </h3>
                <p className="text-xs text-red-700/80 dark:text-red-400/80">
                  Remet à zéro l'ensemble des données locales (sessions, participants, feedbacks, émargements) et réinitialise avec le jeu de données officiel initial IndabaX Bénin 2026.
                </p>
              </div>
            </div>

            {!isResetDialogOpen ? (
              <button
                type="button"
                onClick={() => setIsResetDialogOpen(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Ouvrir la Réinitialisation Complète</span>
              </button>
            ) : (
              <div className="p-4 bg-white dark:bg-stone-900 border border-red-300 dark:border-red-800 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  ⚠️ Action irréversible. Pour confirmer, veuillez saisir <span className="font-mono text-red-600 font-black">RESET</span> ci-dessous :
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Tapez RESET"
                    value={resetConfirmInput}
                    onChange={(e) => setResetConfirmInput(e.target.value)}
                    className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-mono font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    disabled={resetConfirmInput !== 'RESET'}
                    onClick={() => {
                      resetToDefaultData();
                      setIsResetDialogOpen(false);
                      setResetConfirmInput('');
                      alert('Base de données réinitialisée aux valeurs par défaut officielles.');
                    }}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black text-xs rounded-xl transition cursor-pointer"
                  >
                    Confirmer Réinitialisation
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsResetDialogOpen(false); setResetConfirmInput(''); }}
                    className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-800 font-bold"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: GOOGLE WORKSPACE & CLOUD INTEGRATION */}
      {activeAdminTab === 'integrations' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                    Base de données Google Sheet (AppSheet)
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Comptes, rôles, présences et retours dans un classeur partagé par lien. Ni Google Cloud, ni Firebase.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isSheetsLinked ? (
                  <>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Classeur lié</span>
                    </span>
                    <button
                      onClick={() => setIsSheetsSetupOpen(true)}
                      className="px-3.5 py-2 bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 text-white dark:text-stone-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Paramètres</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsSheetsSetupOpen(true)}
                    className="px-4 py-2 bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 text-white dark:text-stone-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Lier le classeur Google Sheet</span>
                  </button>
                )}
              </div>
            </div>

            {sheetsMessage && (
              <div className="p-4 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-xs font-semibold text-stone-800 dark:text-stone-200">
                {sheetsMessage}
              </div>
            )}

            {/* Etat du classeur */}
            <div className="p-5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">
                    Classeur de l&apos;événement
                  </span>
                  <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                    {isSheetsLinked ? 'Classeur lié et lisible' : 'Aucun classeur lié — base locale'}
                  </h4>
                  <p className="text-[11px] text-stone-400">
                    {userAccounts.length} compte(s) en mémoire • onglet des rôles : « {sheetsConfig.profilesTab} »
                    {sheetsConfig.lastSyncTimestamp
                      ? ` • dernière lecture ${new Date(sheetsConfig.lastSyncTimestamp).toLocaleString('fr-FR')}`
                      : ''}
                  </p>
                  {!canWriteToSheets && isSheetsLinked && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-1">
                      Lecture seule : aucune voie d&apos;écriture configurée.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isSheetsLinked && sheetsConfig.masterSheetUrl ? (
                    <a
                      href={sheetsConfig.masterSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ouvrir le classeur</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => setIsSheetsSetupOpen(true)}
                      disabled={isSyncing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Renseigner le lien</span>
                    </button>
                  )}

                  <button
                    onClick={() => runSheetsAction(reloadAccountsFromSheet)}
                    disabled={isSyncing || !isSheetsLinked}
                    className="px-3.5 py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 disabled:opacity-50 disabled:cursor-not-allowed text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Recharger les rôles</span>
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-2 pt-3 border-t border-stone-200 dark:border-stone-700">
                <button
                  onClick={() => runSheetsAction(() => importFromSheets('participants'))}
                  disabled={isSyncing || !isSheetsLinked}
                  className="px-3 py-2 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed border border-stone-200 dark:border-stone-700 rounded-xl text-[11px] font-bold text-stone-800 dark:text-stone-200 transition cursor-pointer"
                >
                  Importer les participants
                </button>
                <button
                  onClick={() => runSheetsAction(() => importFromSheets('sessions'))}
                  disabled={isSyncing || !isSheetsLinked}
                  className="px-3 py-2 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed border border-stone-200 dark:border-stone-700 rounded-xl text-[11px] font-bold text-stone-800 dark:text-stone-200 transition cursor-pointer"
                >
                  Importer les sessions
                </button>
                <button
                  onClick={() => runSheetsAction(pushDataToSheets)}
                  disabled={isSyncing || !isSheetsLinked || !canWriteToSheets}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 rounded-xl text-[11px] font-bold transition cursor-pointer"
                >
                  Envoyer présences &amp; feedbacks
                </button>
              </div>

              {isSheetsLinked && (
                <button
                  onClick={() => {
                    unlinkSheetsDatabase();
                    setSheetsMessage("Classeur délié : l'application repasse en base locale.");
                  }}
                  className="text-[11px] font-bold text-stone-500 hover:text-red-600 transition cursor-pointer"
                >
                  Délier ce classeur
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT SESSION */}
      {(isNewSessionModalOpen || editingSession) && (
        <SessionEditModal
          session={editingSession}
          rooms={generalForm.rooms}
          tracks={ALL_TRACKS}
          types={ALL_TYPES}
          onClose={() => { setEditingSession(null); setIsNewSessionModalOpen(false); }}
          onSave={(data) => {
            if (editingSession) {
              updateSession(editingSession.id, data);
            } else {
              addSession(data);
            }
            setEditingSession(null);
            setIsNewSessionModalOpen(false);
          }}
        />
      )}

      {/* MODAL: CREATE / EDIT PARTICIPANT */}
      {(isNewParticipantModalOpen || editingParticipant) && (
        <ParticipantEditModal
          participant={editingParticipant}
          roles={ALL_ROLES}
          onClose={() => { setEditingParticipant(null); setIsNewParticipantModalOpen(false); }}
          onSave={(data) => {
            if (editingParticipant) {
              updateParticipant(editingParticipant.id, data);
            } else {
              addParticipant(data);
            }
            setEditingParticipant(null);
            setIsNewParticipantModalOpen(false);
          }}
        />
      )}

      {/* MODAL: CREATE / EDIT ANNOUNCEMENT */}
      {(isNewAnnouncementModalOpen || editingAnnouncement) && (
        <AnnouncementEditModal
          announcement={editingAnnouncement}
          authorName={currentUser.name}
          authorRole={currentUser.role}
          authorAvatar={currentUser.avatarUrl}
          onClose={() => { setEditingAnnouncement(null); setIsNewAnnouncementModalOpen(false); }}
          onSave={(data) => {
            if (editingAnnouncement) {
              updateAnnouncement(editingAnnouncement.id, data);
            } else {
              addAnnouncement(data);
            }
            setEditingAnnouncement(null);
            setIsNewAnnouncementModalOpen(false);
          }}
        />
      )}

      {/* MODAL: CREATE CHAT CHANNEL */}
      {isNewChannelModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <span>Nouveau Salon de Discussion</span>
              </h3>
              <button onClick={() => setIsNewChannelModalOpen(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addChannel({
                  name: newChannelForm.name,
                  slug: newChannelForm.slug || newChannelForm.name.toLowerCase().replace(/\s+/g, '-'),
                  description: newChannelForm.description,
                  iconName: newChannelForm.iconName
                });
                setIsNewChannelModalOpen(false);
                setNewChannelForm({ name: '', slug: '', description: '', iconName: 'MessageSquare' });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">Nom du Salon</label>
                <input
                  type="text"
                  placeholder="Ex: hackathon-entraide"
                  value={newChannelForm.name}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">Description / Objectif</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Salon d'échanges et recherche d'équipiers..."
                  value={newChannelForm.description}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-hidden"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChannelModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Créer le Salon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

// ==========================================
// SUB-MODALS FOR CLEAN SURGICAL CRUD ACTIONS
// ==========================================

interface SessionEditModalProps {
  session: Session | null;
  rooms: RoomConfig[];
  tracks: SessionTrack[];
  types: SessionType[];
  onClose: () => void;
  onSave: (data: any) => void;
}

const SessionEditModal: React.FC<SessionEditModalProps> = ({ session, rooms, tracks, types, onClose, onSave }) => {
  const [form, setForm] = useState<Partial<Session>>(session || {
    title: '',
    speaker: '',
    speakerTitle: '',
    speakerInstitution: '',
    speakerPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    day: 1,
    date: '2026-09-18',
    startTime: '09:00',
    endTime: '10:30',
    room: rooms[0]?.name || 'Amphithéâtre Houdégbé (UAC)',
    track: 'Keynote',
    type: 'Keynote',
    level: 'Tous niveaux',
    description: '',
    slidesUrl: '',
    resourcesUrl: '',
    capacity: 100
  });

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-4 my-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            <span>{session ? 'Modifier la Session' : 'Nouvelle Session au Programme'}</span>
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Titre de la Session</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Nom du Speaker</label>
              <input
                type="text"
                value={form.speaker}
                onChange={(e) => setForm({ ...form, speaker: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-semibold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Titre / Rôle</label>
              <input
                type="text"
                value={form.speakerTitle}
                onChange={(e) => setForm({ ...form, speakerTitle: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Institution / Entreprise</label>
              <input
                type="text"
                value={form.speakerInstitution}
                onChange={(e) => setForm({ ...form, speakerInstitution: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Jour (1, 2, 3)</label>
              <select
                value={form.day}
                onChange={(e) => {
                  const day = parseInt(e.target.value);
                  const date = day === 1 ? '2026-09-18' : day === 2 ? '2026-09-19' : '2026-09-20';
                  setForm({ ...form, day, date });
                }}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              >
                <option value={1}>Jour 1 (18 Sept)</option>
                <option value={2}>Jour 2 (19 Sept)</option>
                <option value={3}>Jour 3 (20 Sept)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Heure Début</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Heure Fin</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Capacité (places)</label>
              <input
                type="number"
                min="10"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 50 })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Salle</label>
              <select
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-semibold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.name}>{r.name} ({r.capacity} pl.)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Thématique (Track)</label>
              <select
                value={form.track}
                onChange={(e) => setForm({ ...form, track: e.target.value as SessionTrack })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-semibold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              >
                {tracks.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Format & Niveau</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as SessionType })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-semibold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              >
                {types.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Description Détaillée</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Lien Diapositives (Slides URL)</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.slidesUrl || ''}
                onChange={(e) => setForm({ ...form, slidesUrl: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Lien Ressources / Colab</label>
              <input
                type="url"
                placeholder="https://colab.research.google.com/..."
                value={form.resourcesUrl || ''}
                onChange={(e) => setForm({ ...form, resourcesUrl: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-bold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl cursor-pointer shadow-md"
            >
              Enregistrer Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ParticipantEditModalProps {
  participant: Participant | null;
  roles: { value: ParticipantRole; label: string }[];
  onClose: () => void;
  onSave: (data: any) => void;
}

const ParticipantEditModal: React.FC<ParticipantEditModalProps> = ({ participant, roles, onClose, onSave }) => {
  const [form, setForm] = useState<Partial<Participant>>(participant || {
    name: '',
    email: '',
    role: 'attendee',
    institution: '',
    position: '',
    country: 'Bénin',
    city: 'Cotonou',
    bio: '',
    interests: ['Deep Learning', 'NLP', 'Computer Vision'],
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80'
  });

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>{participant ? 'Modifier le Participant' : 'Ajouter un Participant'}</span>
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
          className="space-y-3.5 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Nom Complet</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Rôle & Accréditation</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as ParticipantRole })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              >
                {roles.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Institution</label>
              <input
                type="text"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Poste / Titre</label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Ville</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Courte Biographie</label>
            <textarea
              rows={2}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-bold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AnnouncementEditModalProps {
  announcement: Announcement | null;
  authorName: string;
  authorRole: ParticipantRole;
  authorAvatar: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

const AnnouncementEditModal: React.FC<AnnouncementEditModalProps> = ({ announcement, authorName, authorRole, authorAvatar, onClose, onSave }) => {
  const [form, setForm] = useState({
    title: announcement?.title || '',
    content: announcement?.content || '',
    category: announcement?.category || 'URGENT' as AnnouncementCategory,
    priority: announcement?.priority || 'high' as 'normal' | 'high' | 'urgent',
    pinned: announcement?.pinned ?? true,
    authorName: announcement?.authorName || authorName,
    authorRole: announcement?.authorRole || authorRole,
    authorAvatar: announcement?.authorAvatar || authorAvatar
  });

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            <span>{announcement ? 'Modifier le Communiqué' : 'Nouveau Communiqué Officiel'}</span>
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
          className="space-y-3.5 text-xs"
        >
          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Titre de l'Annonce</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Catégorie</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as AnnouncementCategory })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              >
                <option value="URGENT">URGENT</option>
                <option value="PROGRAMME">PROGRAMME</option>
                <option value="LOGISTIQUE">LOGISTIQUE</option>
                <option value="KEYNOTE">KEYNOTE</option>
                <option value="SOCIAL">SOCIAL</option>
                <option value="HACKATHON">HACKATHON</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Niveau de Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden"
              >
                <option value="normal">Normal</option>
                <option value="high">Élevé (High)</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Texte du Communiqué</label>
            <textarea
              rows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pinnedCheck"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              className="rounded text-amber-500 focus:ring-amber-400"
            />
            <label htmlFor="pinnedCheck" className="text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer">
              Épingler en tête de liste des annonces
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-bold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl cursor-pointer"
            >
              Publier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
