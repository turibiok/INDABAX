import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  Bookmark, 
  BookmarkCheck, 
  Star, 
  QrCode, 
  FileText, 
  ExternalLink, 
  CalendarPlus, 
  Search, 
  Filter, 
  Users,
  CheckCircle,
  Sparkles,
  Info,
  ChevronRight,
  X
} from 'lucide-react';
import { Session, SessionTrack } from '../types';
import { useEvent } from '../context/EventContext';

export const ScheduleView: React.FC<{
  onOpenScannerForSession: (session: Session) => void;
  onOpenFeedbackForSession: (session: Session) => void;
}> = ({ onOpenScannerForSession, onOpenFeedbackForSession }) => {
  const { 
    sessions, 
    selectedDay, 
    setSelectedDay, 
    searchQuery, 
    setSearchQuery, 
    selectedTrack, 
    setSelectedTrack,
    savedSessionIds,
    toggleSaveSession,
    checkIns,
    feedbacks,
    addSessionToCalendar
  } = useEvent();

  const [filterMode, setFilterMode] = useState<'all' | 'saved'>('all');
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<Session | null>(null);
  const [calendarAddingId, setCalendarAddingId] = useState<string | null>(null);
  const [calendarSuccessMsg, setCalendarSuccessMsg] = useState<string | null>(null);

  const days = [
    { day: 1, date: "18 Septembre 2026", theme: "Fondations, Vision & Imagerie" },
    { day: 2, date: "19 Septembre 2026", theme: "NLP, Langues Africaines & LLMs" },
    { day: 3, date: "20 Septembre 2026", theme: "Hackathon & Déploiement IA" }
  ];

  const tracks: { id: string; label: string; color: string }[] = [
    { id: 'all', label: 'Toutes les pistes', color: 'bg-stone-100 text-stone-800 border-stone-300' },
    { id: 'NLP & Langues Africaines', label: 'NLP & Fongbe/Yoruba', color: 'bg-amber-50 text-amber-900 border-amber-300' },
    { id: 'Computer Vision & Santé', label: 'Vision & Santé', color: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
    { id: 'Fondamentaux ML', label: 'Fondamentaux ML', color: 'bg-blue-50 text-blue-900 border-blue-300' },
    { id: 'Generative AI & LLMs', label: 'Generative AI & RAG', color: 'bg-purple-50 text-purple-900 border-purple-300' },
    { id: 'Entrepreneuriat & Éthique', label: 'Éthique & Agriculture', color: 'bg-rose-50 text-rose-900 border-rose-300' },
    { id: 'Keynote', label: 'Keynotes & Plénières', color: 'bg-amber-500 text-stone-950 font-bold border-amber-400' },
  ];

  // Filter logic
  const filteredSessions = sessions.filter(session => {
    // Day filter
    if (session.day !== selectedDay) return false;

    // Track filter
    if (selectedTrack !== 'all' && session.track !== selectedTrack) return false;

    // Saved filter
    if (filterMode === 'saved' && !savedSessionIds.includes(session.id)) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = session.title.toLowerCase().includes(q);
      const matchSpeaker = session.speaker.toLowerCase().includes(q);
      const matchRoom = session.room.toLowerCase().includes(q);
      const matchDesc = session.description.toLowerCase().includes(q);
      const matchTrack = session.track.toLowerCase().includes(q);
      if (!matchTitle && !matchSpeaker && !matchRoom && !matchDesc && !matchTrack) return false;
    }

    return true;
  });

  // Ajout au calendrier via un simple lien Google Calendar : aucune connexion requise.
  const handleCalendarAdd = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();

    try {
      setCalendarAddingId(session.id);
      await addSessionToCalendar(session);
      setCalendarSuccessMsg(`Google Calendar ouvert pour « ${session.title.slice(0, 30)}… »`);
      setTimeout(() => setCalendarSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Erreur lors de l'ajout au calendrier : " + err.message);
    } finally {
      setCalendarAddingId(null);
    }
  };

  const getTrackColor = (track: SessionTrack) => {
    switch (track) {
      case 'NLP & Langues Africaines': return 'text-amber-900 bg-amber-50 border-amber-300';
      case 'Computer Vision & Santé': return 'text-emerald-900 bg-emerald-50 border-emerald-300';
      case 'Generative AI & LLMs': return 'text-purple-900 bg-purple-50 border-purple-300';
      case 'Fondamentaux ML': return 'text-blue-900 bg-blue-50 border-blue-300';
      case 'Entrepreneuriat & Éthique': return 'text-rose-900 bg-rose-50 border-rose-300';
      default: return 'text-amber-900 bg-amber-50 border-amber-300';
    }
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Hero Banner with Vibrant Baobab aesthetic */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 border border-emerald-700/50 p-6 sm:p-8 shadow-xl text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300 text-amber-300 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Programme Officiel IndabaX Bénin 2026
          </div>
          <h1 className="text-2xl sm:text-4xl font-heading font-black text-white tracking-tight leading-tight mb-2">
            Renforcer la Recherche en IA & Deep Learning au <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-emerald-300 bg-clip-text text-transparent">Bénin</span>
          </h1>
          <p className="text-emerald-50 text-sm sm:text-base leading-relaxed">
            Consultez le programme des 3 jours, réservez vos ateliers, émergez instantanément par scan QR et transmettez vos avis synchronisés sur Google Sheets.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-emerald-700/60">
            <div>
              <p className="text-xl sm:text-2xl font-black text-white font-heading">{sessions.length}</p>
              <p className="text-xs text-emerald-200">Sessions & Ateliers</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-amber-300 font-heading">3 Jours</p>
              <p className="text-xs text-emerald-200">18 - 20 Septembre</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-emerald-300 font-heading">{checkIns.length}</p>
              <p className="text-xs text-emerald-200">Émargements Scannés</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification toast if calendar event added */}
      {calendarSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-400 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-semibold">{calendarSuccessMsg}</span>
          </div>
          <button onClick={() => setCalendarSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Day Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {days.map((d) => {
          const isSelected = selectedDay === d.day;
          return (
            <button
              key={d.day}
              id={`day-tab-${d.day}`}
              onClick={() => setSelectedDay(d.day)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/80 border-2 border-emerald-700 shadow-md ring-1 ring-emerald-600/30'
                  : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-600 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-800' : 'text-stone-500'}`}>
                  Jour {d.day}
                </span>
                <span className="text-[11px] text-stone-500 font-semibold">{d.date}</span>
              </div>
              <p className={`font-heading font-bold text-sm truncate ${isSelected ? 'text-stone-900' : 'text-stone-700'}`}>
                {d.theme}
              </p>
            </button>
          );
        })}
      </div>

      {/* Controls: Search, Track Filters & Saved Filter */}
      <div className="space-y-3 bg-white border border-stone-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              id="input-schedule-search"
              type="text"
              placeholder="Rechercher une session, conférencier, salle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View mode: All vs My Saved */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="bg-stone-100 p-1 rounded-xl border border-stone-200 flex items-center w-full sm:w-auto">
              <button
                id="btn-filter-all"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 sm:flex-initial transition cursor-pointer ${
                  filterMode === 'all' ? 'bg-white text-emerald-900 font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Toutes les sessions ({sessions.filter(s => s.day === selectedDay).length})
              </button>
              <button
                id="btn-filter-saved"
                onClick={() => setFilterMode('saved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 sm:flex-initial flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  filterMode === 'saved' ? 'bg-white text-emerald-900 font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                Mon Programme ({sessions.filter(s => s.day === selectedDay && savedSessionIds.includes(s.id)).length})
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Track Scroll / Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
          <span className="text-[11px] text-stone-500 font-bold flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" /> Pistes :
          </span>
          {tracks.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTrack(t.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 border transition cursor-pointer ${
                selectedTrack === t.id
                  ? 'bg-emerald-800 text-white border-emerald-800 font-bold shadow-xs'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Session Cards List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-xs">
          <CalendarIcon className="w-12 h-12 text-stone-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-900 mb-1">Aucune session trouvée</h3>
          <p className="text-stone-500 text-xs max-w-sm mx-auto mb-4">
            Aucune session ne correspond à vos filtres actuels pour le Jour {selectedDay}. Essayez de réinitialiser la recherche.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedTrack('all'); setFilterMode('all'); }}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const isSaved = savedSessionIds.includes(session.id);
            const sessionFeedbacks = feedbacks.filter(f => f.sessionId === session.id);
            const avgRating = sessionFeedbacks.length > 0 
              ? (sessionFeedbacks.reduce((acc, curr) => acc + curr.overallRating, 0) / sessionFeedbacks.length).toFixed(1)
              : null;
            const sessionCheckIns = checkIns.filter(c => c.sessionId === session.id);

            return (
              <div
                key={session.id}
                id={`session-card-${session.id}`}
                className="bg-white hover:bg-stone-50/50 border border-stone-200 hover:border-amber-400/80 rounded-2xl p-5 transition-all shadow-xs hover:shadow-md group"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  
                  {/* Left info column */}
                  <div className="space-y-3 flex-1">
                    
                    {/* Top tags row: Time, Room, Track, Level */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>{session.startTime} - {session.endTime}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 bg-stone-50 text-stone-700 border border-stone-200 px-2.5 py-1 rounded-lg font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-rose-600" />
                        <span>{session.room}</span>
                      </div>

                      <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${getTrackColor(session.track)}`}>
                        {session.track}
                      </span>

                      <span className="bg-stone-100 text-stone-600 border border-stone-200 px-2 py-0.5 rounded text-[11px] font-medium">
                        {session.type} • {session.level}
                      </span>
                    </div>

                    {/* Session Title */}
                    <h3 
                      onClick={() => setSelectedSessionForModal(session)}
                      className="text-base sm:text-lg font-heading font-black text-stone-900 group-hover:text-emerald-800 transition cursor-pointer leading-snug"
                    >
                      {session.title}
                    </h3>

                    {/* Speaker Info */}
                    <div className="flex items-center gap-3">
                      <img
                        src={session.speakerPhoto}
                        alt={session.speaker}
                        className="w-9 h-9 rounded-xl object-cover ring-1 ring-stone-300"
                      />
                      <div>
                        <p className="text-xs font-bold text-stone-900">{session.speaker}</p>
                        <p className="text-[11px] text-stone-500 font-medium">{session.speakerTitle} • <span className="text-amber-700 font-semibold">{session.speakerInstitution}</span></p>
                      </div>
                    </div>

                    {/* Short Description */}
                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {session.description}
                    </p>

                    {/* Live Stats: Check-ins & Feedbacks */}
                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1 text-stone-500 border-t border-stone-100 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span><strong className="text-stone-900">{sessionCheckIns.length}</strong> / {session.capacity} participants enregistrés</span>
                      </div>

                      {avgRating && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          <span className="font-bold text-stone-900">{avgRating}/5</span>
                          <span className="text-stone-400 font-normal">({sessionFeedbacks.length} avis)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Action buttons */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                    
                    {/* Bookmark Toggle */}
                    <button
                      onClick={() => toggleSaveSession(session.id)}
                      className={`p-2 rounded-xl border transition cursor-pointer ${
                        isSaved 
                          ? 'bg-amber-400 text-stone-950 border-amber-500 shadow-xs' 
                          : 'bg-stone-50 border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                      }`}
                      title={isSaved ? "Retirer de mon programme" : "Ajouter à mon programme"}
                    >
                      {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>

                    {/* Fast QR Scan for attendance check-in */}
                    <button
                      onClick={() => onOpenScannerForSession(session)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                      title="Scanner les participants pour cette session"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Scanner</span>
                    </button>

                    {/* Feedback Button */}
                    <button
                      onClick={() => onOpenFeedbackForSession(session)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                      <span>Donner avis</span>
                    </button>

                    {/* Google Calendar Add */}
                    <button
                      onClick={(e) => handleCalendarAdd(e, session)}
                      disabled={calendarAddingId === session.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                      title="Ajouter à mon Google Calendar"
                    >
                      <CalendarPlus className={`w-3.5 h-3.5 text-blue-600 ${calendarAddingId === session.id ? 'animate-spin' : ''}`} />
                      <span>Google Cal</span>
                    </button>

                    {/* Details modal button */}
                    <button
                      onClick={() => setSelectedSessionForModal(session)}
                      className="p-2 text-stone-400 hover:text-stone-700"
                      title="Voir les détails complets"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSessionForModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 text-stone-900">
            
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${getTrackColor(selectedSessionForModal.track)}`}>
                  {selectedSessionForModal.track}
                </span>
                <span className="bg-stone-100 text-stone-800 border border-stone-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                  Jour {selectedSessionForModal.day} • {selectedSessionForModal.startTime} - {selectedSessionForModal.endTime}
                </span>
              </div>
              <button
                onClick={() => setSelectedSessionForModal(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-xl sm:text-2xl font-heading font-black text-stone-900 mb-4">
              {selectedSessionForModal.title}
            </h2>

            {/* Speaker Card */}
            <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200 mb-6">
              <img
                src={selectedSessionForModal.speakerPhoto}
                alt={selectedSessionForModal.speaker}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-emerald-600/40"
              />
              <div>
                <p className="text-sm font-bold text-stone-900">{selectedSessionForModal.speaker}</p>
                <p className="text-xs text-amber-700 font-semibold">{selectedSessionForModal.speakerTitle}</p>
                <p className="text-xs text-stone-500">{selectedSessionForModal.speakerInstitution}</p>
              </div>
            </div>

            {/* Description & Details */}
            <div className="space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed mb-6">
              <div>
                <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-1">À propos de la session :</h4>
                <p>{selectedSessionForModal.description}</p>
              </div>

              {selectedSessionForModal.prerequisites && (
                <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl text-amber-900 font-medium">
                  <span className="font-bold">Prérequis / Matériel : </span>
                  {selectedSessionForModal.prerequisites}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <p className="text-[11px] text-stone-500 font-medium">Lieu / Salle</p>
                  <p className="text-xs font-bold text-stone-900">{selectedSessionForModal.room}</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <p className="text-[11px] text-stone-500 font-medium">Capacité de la salle</p>
                  <p className="text-xs font-bold text-stone-900">{selectedSessionForModal.capacity} places</p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-stone-200">
              <button
                onClick={() => {
                  onOpenScannerForSession(selectedSessionForModal);
                  setSelectedSessionForModal(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                Scanner & Émarger Présence
              </button>

              <button
                onClick={() => {
                  onOpenFeedbackForSession(selectedSessionForModal);
                  setSelectedSessionForModal(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                <Star className="w-4 h-4" />
                Donner mon Avis
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
