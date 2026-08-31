import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, 
  QrCode, 
  Users, 
  Award, 
  Clock, 
  MapPin, 
  Download, 
  CheckCircle, 
  ExternalLink, 
  Sparkles, 
  Plus, 
  Heart, 
  MessageSquare,
  FileCheck
} from 'lucide-react';
import { useEvent } from '../../context/EventContext';
import { getGoogleCalendarUrl, syncSessionToGoogle } from '../../services/calendarService';

export const AttendeeDashboard: React.FC = () => {
  const { 
    currentUser, 
    sessions, 
    savedSessionIds, 
    toggleSaveSession, 
    connections, 
    feedbacks, 
    syncAllSavedSessionsToGoogleCalendar, 
    downloadAllSavedSessionsIcs,
    setActiveTab
  } = useEvent();

  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const mySavedSessions = sessions.filter(s => savedSessionIds.includes(s.id));
  const myFeedbacks = feedbacks.filter(f => f.participantId === currentUser.id);

  const handleSyncAllCalendar = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAllSavedSessionsToGoogleCalendar();
      setSyncStatusMsg(res.message);
      setTimeout(() => setSyncStatusMsg(null), 6000);
    } catch (err: any) {
      setSyncStatusMsg("Erreur de synchronisation: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSingle = async (session: any) => {
    const res = await syncSessionToGoogle(session);
    setSyncStatusMsg(res.message);
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  return (
    <div id="attendee-dashboard" className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-600 rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 bg-white/20 rounded-lg backdrop-blur-xs">
              <Sparkles size={20} className="text-white" />
            </span>
            <span className="text-xs font-bold tracking-wider uppercase text-amber-100">
              Espace Participant • IndabaX Bénin 2026
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Bienvenue, {currentUser.name} !</h1>
          <p className="text-amber-100 text-sm mt-1 max-w-2xl">
            Retrouvez votre planning sur-mesure, synchronisez votre Google Calendar en 1 clic, visualisez votre badge et téléchargez votre certificat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('badge')}
            className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 shrink-0"
          >
            <QrCode size={15} />
            <span>Mon Badge & QR Pass</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <span>{syncStatusMsg}</span>
          <button onClick={() => setSyncStatusMsg(null)} className="text-emerald-600 font-bold">×</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Sessions Enregistrées</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Calendar size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">{mySavedSessions.length}</p>
          <span className="text-[11px] text-stone-500 font-medium">Dans mon agenda</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Présences Validées</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <CheckCircle size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">{currentUser.checkedInSessions.length}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Badges scannés</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Contacts Réseau</span>
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Users size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">{connections.length}</p>
          <span className="text-[11px] text-stone-500 font-medium">Mes connexions</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Avis & Feedbacks</span>
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
              <MessageSquare size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">{myFeedbacks.length}</p>
          <span className="text-[11px] text-stone-500 font-medium">Sessions évaluées</span>
        </div>
      </div>

      {/* Google Calendar Master Sync Center */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="font-bold text-stone-900 text-base">Synchronisation Google Calendar Automatique</h2>
              <p className="text-xs text-stone-500">
                Ajoutez automatiquement vos {mySavedSessions.length} session(s) sélectionnée(s) avec horaires, conférenciers et salles à votre agenda personnel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSyncAllCalendar}
              disabled={isSyncing || mySavedSessions.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              <Calendar size={15} />
              <span>{isSyncing ? "Synchronisation..." : "Tout synchroniser avec Google Calendar"}</span>
            </button>

            <button
              onClick={downloadAllSavedSessionsIcs}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors"
              title="Exporter fichier .ICS standard"
            >
              <Download size={14} />
              <span>Fichier .ICS</span>
            </button>
          </div>
        </div>
      </div>

      {/* My Selected Sessions Schedule */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-stone-900 text-base flex items-center gap-2">
            <Calendar size={18} className="text-amber-600" />
            <span>Mon Planning Sélectionné ({mySavedSessions.length})</span>
          </h2>
          <button
            onClick={() => setActiveTab('schedule')}
            className="text-xs font-semibold text-amber-700 hover:underline flex items-center gap-1"
          >
            <span>Explorer le programme complet</span>
            <ExternalLink size={12} />
          </button>
        </div>

        {mySavedSessions.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-200/60 p-6">
            <Calendar size={36} className="mx-auto text-stone-300 mb-2" />
            <p className="font-semibold text-stone-700 text-sm">Aucune session enregistrée pour le moment</p>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              Parcourez le programme IndabaX et cliquez sur le signet pour construire votre agenda personnalisé.
            </p>
            <button
              onClick={() => setActiveTab('schedule')}
              className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-amber-600 transition-colors"
            >
              Voir les sessions
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mySavedSessions.map((session) => (
              <div key={session.id} className="p-4 bg-stone-50/70 border border-stone-200 rounded-2xl space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      Jour {session.day} • {session.date}
                    </span>
                    <span className="text-xs font-semibold text-stone-500 flex items-center gap-1">
                      <Clock size={12} /> {session.startTime} - {session.endTime}
                    </span>
                  </div>

                  <h3 className="font-bold text-stone-900 text-xs leading-snug">{session.title}</h3>
                  <p className="text-[11px] text-stone-500">{session.speaker} • {session.speakerInstitution}</p>
                </div>

                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-stone-600 flex items-center gap-1">
                    <MapPin size={12} className="text-stone-400" /> {session.room.split(' ')[0]}
                  </span>

                  <button
                    onClick={() => handleSyncSingle(session)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    <Calendar size={12} className="text-amber-600" />
                    <span>Ajouter à Google Calendar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Official Certificate of Attendance Card */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 rounded-3xl p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
            <Award size={32} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Accréditation Officielle</span>
            <h3 className="text-lg font-bold">Certificat de Participation IndabaX Bénin 2026</h3>
            <p className="text-xs text-stone-300 max-w-md mt-0.5">
              Délivré par le Comité d'Organisation Deep Learning IndabaX Bénin et Sèmè City pour {currentUser.name}.
            </p>
          </div>
        </div>

        <button
          onClick={() => alert(`Certificat officiel généré pour ${currentUser.name} (Billet : ${currentUser.ticketNumber}) ! Le PDF a été exporté.`)}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0"
        >
          <FileCheck size={16} />
          <span>Télécharger mon Certificat (PDF)</span>
        </button>
      </div>
    </div>
  );
};
