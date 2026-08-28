import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  FileText, 
  Upload, 
  HelpCircle, 
  Star, 
  CheckCircle, 
  Plus, 
  ExternalLink, 
  BookOpen, 
  Code, 
  Send,
  MessageSquare,
  BarChart2
} from 'lucide-react';
import { useEvent } from '../../context/EventContext';
import { SpeakerResource } from '../../types';
import { getGoogleCalendarUrl, syncSessionToGoogle } from '../../services/calendarService';

export const SpeakerDashboard: React.FC = () => {
  const { 
    currentUser, 
    sessions, 
    feedbacks, 
    speakerResources, 
    addSpeakerResource,
    addAnnouncement
  } = useEvent();

  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState<'slides' | 'notebook' | 'dataset' | 'paper' | 'github'>('slides');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[0]?.id || '');
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, string>>({});
  const [syncFeedbackMsg, setSyncFeedbackMsg] = useState<string | null>(null);

  // Match sessions where this speaker is assigned or all sessions if testing
  const mySessions = sessions.filter(s => 
    s.speaker.toLowerCase().includes(currentUser.name.toLowerCase()) || 
    currentUser.name.toLowerCase().includes(s.speaker.toLowerCase()) ||
    currentUser.role === 'speaker'
  );

  const displaySessions = mySessions.length > 0 ? mySessions : sessions.slice(0, 2);

  // Filter feedbacks for my sessions
  const myFeedbacks = feedbacks.filter(f => 
    displaySessions.some(s => s.id === f.sessionId)
  );

  const questionsFromAudience = myFeedbacks.filter(f => f.questionForSpeaker && f.questionForSpeaker.trim().length > 0);

  const avgRating = myFeedbacks.length > 0
    ? (myFeedbacks.reduce((acc, f) => acc + f.overallRating, 0) / myFeedbacks.length).toFixed(1)
    : '5.0';

  const avgClarity = myFeedbacks.length > 0
    ? (myFeedbacks.reduce((acc, f) => acc + f.speakerClarity, 0) / myFeedbacks.length).toFixed(1)
    : '4.8';

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceTitle.trim() || !resourceUrl.trim()) return;

    addSpeakerResource({
      sessionId: selectedSessionId || displaySessions[0].id,
      title: resourceTitle.trim(),
      type: resourceType,
      url: resourceUrl.trim()
    });

    setResourceTitle('');
    setResourceUrl('');
  };

  const handleAnswerQuestion = (fbkId: string) => {
    const text = replyText[fbkId]?.trim();
    if (!text) return;
    setAnsweredQuestions(prev => ({ ...prev, [fbkId]: text }));
    setReplyText(prev => ({ ...prev, [fbkId]: '' }));
  };

  const handleSyncToCalendar = async (session: any) => {
    const res = await syncSessionToGoogle(session);
    setSyncFeedbackMsg(res.message);
    setTimeout(() => setSyncFeedbackMsg(null), 5000);
  };

  return (
    <div id="speaker-dashboard" className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 bg-white/20 rounded-lg backdrop-blur-xs">
              <Sparkles size={20} className="text-white" />
            </span>
            <span className="text-xs font-bold tracking-wider uppercase text-indigo-200">
              Espace Intervenant & Conférencier
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Espace Conférencier : {currentUser.name}</h1>
          <p className="text-indigo-100 text-sm mt-1 max-w-2xl">
            Gérez vos interventions, synchronisez votre calendrier Google, déposez vos slides/notebooks et répondez aux questions de l'auditoire.
          </p>
        </div>
      </div>

      {syncFeedbackMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>{syncFeedbackMsg}</span>
          <button onClick={() => setSyncFeedbackMsg(null)} className="text-emerald-600 font-bold">×</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Sessions Assignées</span>
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Calendar size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">{displaySessions.length}</p>
          <span className="text-[11px] text-stone-500 font-medium">Programme IndabaX Bénin</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Satisfaction Globale</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Star size={16} className="fill-amber-500 text-amber-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">{avgRating} / 5</p>
          <span className="text-[11px] text-emerald-600 font-medium">Clarté orateur : {avgClarity}/5</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Questions de l'Auditoire</span>
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
              <HelpCircle size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">{questionsFromAudience.length}</p>
          <span className="text-[11px] text-stone-500 font-medium">Questions posées en direct</span>
        </div>
      </div>

      {/* Assigned Sessions */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-4">
        <h2 className="font-bold text-stone-900 text-base flex items-center gap-2">
          <Calendar size={18} className="text-indigo-600" />
          <span>Mes Interventions au Programme</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displaySessions.map((ses) => {
            const occupancyPct = Math.round((ses.currentAttendees / ses.capacity) * 100);
            return (
              <div key={ses.id} className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                    Jour {ses.day} • {ses.date}
                  </span>
                  <span className="text-xs font-semibold text-stone-500 flex items-center gap-1">
                    <Clock size={13} /> {ses.startTime} - {ses.endTime}
                  </span>
                </div>

                <h3 className="font-bold text-stone-900 text-sm leading-snug">{ses.title}</h3>

                <div className="flex items-center gap-4 text-xs text-stone-600">
                  <span className="flex items-center gap-1"><MapPin size={13} className="text-stone-400" /> {ses.room}</span>
                  <span className="flex items-center gap-1"><Users size={13} className="text-stone-400" /> {ses.currentAttendees} / {ses.capacity} inscrits</span>
                </div>

                {/* Capacity Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-stone-500">
                    <span>Taux d'occupation</span>
                    <span className="font-semibold text-stone-700">{occupancyPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        occupancyPct > 85 ? 'bg-red-500' : occupancyPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} 
                      style={{ width: `${Math.min(occupancyPct, 100)}%` }} 
                    />
                  </div>
                </div>

                {/* 1-Click Sync to Calendar */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleSyncToCalendar(ses)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                  >
                    <Calendar size={14} />
                    <span>Ajouter à mon Google Calendar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Resource Repository + Live Q&R */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resources & Slides Depot */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <BookOpen size={18} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Supports de Cours & Slides</h3>
                <p className="text-xs text-stone-500">Mettez à disposition vos présentations, notebooks et repos.</p>
              </div>
            </div>

            {/* List of uploaded resources */}
            <div className="space-y-2 mb-4">
              {speakerResources.map(res => (
                <div key={res.id} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/70 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      {res.type === 'notebook' ? <Code size={13} /> : <FileText size={13} />}
                    </span>
                    <span className="font-medium text-stone-800 truncate">{res.title}</span>
                  </div>
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 shrink-0 ml-2"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>

            {/* Upload Form */}
            <form onSubmit={handleAddResource} className="space-y-3 pt-2 border-t border-stone-100">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Titre de la ressource</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Slides Keynote (PDF) ou Colab Notebook"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Type</label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="slides">Slides (PDF)</option>
                    <option value="notebook">Jupyter / Google Colab</option>
                    <option value="github">GitHub Repository</option>
                    <option value="paper">Article / Paper</option>
                    <option value="dataset">Dataset</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Session Associée</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    {displaySessions.map(s => (
                      <option key={s.id} value={s.id}>{s.title.slice(0, 28)}...</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">URL (Drive, GitHub, Colab, PDF)</label>
                <input
                  type="url"
                  required
                  placeholder="https://colab.research.google.com/..."
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Publier le support pour les participants</span>
              </button>
            </form>
          </div>
        </div>

        {/* Live Audience Questions & Feedback */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Questions & Retours de l'Auditoire</h3>
                <p className="text-xs text-stone-500">Répondez aux participants ayant assisté à votre session.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
            {questionsFromAudience.length === 0 ? (
              <div className="text-center py-10 text-stone-400 text-xs">
                <HelpCircle size={32} className="mx-auto text-stone-300 mb-2" />
                <p className="font-semibold text-stone-700">Aucune question en attente</p>
                <p className="text-stone-500 mt-0.5">Les questions posées dans les formulaires d'évaluation apparaîtront ici.</p>
              </div>
            ) : (
              questionsFromAudience.map(item => {
                const answer = answeredQuestions[item.id];
                return (
                  <div key={item.id} className="p-3.5 bg-stone-50/80 border border-stone-200/80 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="font-semibold text-stone-800">{item.participantName}</span>
                      <span className="text-[10px]">{new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <p className="font-medium text-stone-900 bg-white p-2.5 rounded-lg border border-stone-200/60 italic">
                      « {item.questionForSpeaker} »
                    </p>

                    {answer ? (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                          <CheckCircle size={12} /> Votre Réponse :
                        </span>
                        <p>{answer}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Écrire votre réponse..."
                          value={replyText[item.id] || ''}
                          onChange={(e) => setReplyText(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAnswerQuestion(item.id);
                          }}
                          className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs text-stone-800"
                        />
                        <button
                          onClick={() => handleAnswerQuestion(item.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                        >
                          <Send size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
