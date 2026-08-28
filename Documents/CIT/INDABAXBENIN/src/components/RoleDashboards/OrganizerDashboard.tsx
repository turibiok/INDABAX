import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  RefreshCw,
  TrendingUp,
  UserPlus,
  BarChart3,
  QrCode,
  Radio,
  ExternalLink,
  Plus,
  Clock,
  Sparkles,
  AlertTriangle,
  Upload,
  PieChart as PieIcon,
  Star,
  Layers,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { useEvent } from '../../context/EventContext';
import { Participant } from '../../types';

const COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#8b5cf6', '#06b6d4'];

export const OrganizerDashboard: React.FC = () => {
  const {
    sessions,
    participants,
    checkIns,
    feedbacks,
    sheetsConfig,
    isSheetsLinked,
    canWriteToSheets,
    isSyncing,
    pushDataToSheets,
    importFromSheets,
    exportToCsv,
    setActiveTab,
    setIsImportModalOpen,
    setIsSheetsSetupOpen,
    openScanner,
    theme
  } = useEvent();

  const [sheetsMessage, setSheetsMessage] = useState<string | null>(null);

  const runSheetsAction = async (action: () => Promise<string>) => {
    try {
      setSheetsMessage(await action());
    } catch (error: any) {
      setSheetsMessage(error?.message || 'Opération impossible.');
    }
    setTimeout(() => setSheetsMessage(null), 6000);
  };

  const [newAttendeeName, setNewAttendeeName] = useState('');
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('');
  const [newAttendeeOrg, setNewAttendeeOrg] = useState('');
  const [newAttendeeRole, setNewAttendeeRole] = useState<'attendee' | 'speaker' | 'volunteer'>('attendee');
  const [justAddedBadge, setJustAddedBadge] = useState<string | null>(null);
  const [chartViewFilter, setChartViewFilter] = useState<'all' | 'day1' | 'day2' | 'day3'>('all');

  // Metrics
  const totalRegistrations = participants.length;
  const totalCheckIns = checkIns.length;
  const uniqueAttendeesCheckedIn = new Set(checkIns.map(c => c.participantId)).size;
  const globalCheckInRate = totalRegistrations > 0 ? Math.round((uniqueAttendeesCheckedIn / totalRegistrations) * 100) : 0;

  const totalFeedbacks = feedbacks.length;
  const avgSatisfaction = totalFeedbacks > 0
    ? (feedbacks.reduce((acc, f) => acc + f.overallRating, 0) / totalFeedbacks).toFixed(1)
    : '5.0';

  // 1. Session Attendance Data Preparation for Recharts
  const sessionParticipationData = useMemo(() => {
    return sessions
      .filter(s => {
        if (chartViewFilter === 'day1') return s.day === 1;
        if (chartViewFilter === 'day2') return s.day === 2;
        if (chartViewFilter === 'day3') return s.day === 3;
        return true;
      })
      .map(s => {
        const sessionScans = checkIns.filter(c => c.sessionId === s.id).length;
        const fillRate = s.capacity > 0 ? Math.min(100, Math.round((sessionScans / s.capacity) * 100)) : 0;

        // Shorten title for x-axis display
        const shortTitle = s.title.length > 22 ? s.title.substring(0, 20) + '...' : s.title;

        return {
          id: s.id,
          fullName: s.title,
          name: shortTitle,
          room: s.room,
          presences: sessionScans,
          capacite: s.capacity,
          tauxRemplissage: fillRate,
          speaker: s.speaker
        };
      });
  }, [sessions, checkIns, chartViewFilter]);

  // 2. Feedback Summary by Session Data for Recharts
  const feedbackSynthesisData = useMemo(() => {
    return sessions.map(s => {
      const sessionFeedbacks = feedbacks.filter(f => f.sessionId === s.id);
      const count = sessionFeedbacks.length;

      const avgOverall = count > 0
        ? +(sessionFeedbacks.reduce((sum, f) => sum + f.overallRating, 0) / count).toFixed(1)
        : 0;

      const avgRelevance = count > 0
        ? +(sessionFeedbacks.reduce((sum, f) => sum + f.practicalRelevance, 0) / count).toFixed(1)
        : 0;

      const avgClarity = count > 0
        ? +(sessionFeedbacks.reduce((sum, f) => sum + f.speakerClarity, 0) / count).toFixed(1)
        : 0;

      return {
        name: s.title.length > 20 ? s.title.substring(0, 18) + '...' : s.title,
        fullName: s.title,
        evaluations: count,
        noteGlobale: avgOverall,
        pertinence: avgRelevance,
        clarte: avgClarity,
        speaker: s.speaker
      };
    }).filter(d => d.evaluations > 0 || totalFeedbacks < 5); // show top rated or all
  }, [sessions, feedbacks, totalFeedbacks]);

  // 3. Participants breakdown by role
  const roleDistributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    participants.forEach(p => {
      const r = p.role || 'attendee';
      counts[r] = (counts[r] || 0) + 1;
    });

    const labels: Record<string, string> = {
      attendee: 'Auditeurs',
      speaker: 'Speakers',
      volunteer: 'Volontaires',
      organizer: 'Organisateurs',
      sponsor: 'Sponsors'
    };

    return Object.keys(counts).map((roleKey, idx) => ({
      name: labels[roleKey] || roleKey,
      value: counts[roleKey],
      color: COLORS[idx % COLORS.length]
    }));
  }, [participants]);

  const handleQuickRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttendeeName.trim() || !newAttendeeEmail.trim()) return;

    const ticketNumber = `INDABAX-BJ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newP: Participant = {
      id: `usr-${Date.now()}`,
      ticketNumber,
      name: newAttendeeName.trim(),
      email: newAttendeeEmail.trim().toLowerCase(),
      role: newAttendeeRole,
      institution: newAttendeeOrg.trim() || 'IndabaX Bénin',
      position: 'Participant sur place',
      country: 'Bénin',
      city: 'Cotonou',
      avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80`,
      bio: 'Enregistrement direct au desk d\'accueil.',
      interests: ['IA', 'Machine Learning'],
      checkedInSessions: []
    };

    const stored = JSON.parse(localStorage.getItem('indabax_participants') || '[]');
    localStorage.setItem('indabax_participants', JSON.stringify([newP, ...stored]));
    setJustAddedBadge(`Billet généré : ${ticketNumber} pour ${newP.name}`);

    setNewAttendeeName('');
    setNewAttendeeEmail('');
    setNewAttendeeOrg('');
  };

  const isDarkMode = theme === 'dark';
  const gridColor = isDarkMode ? '#292524' : '#f5f5f4';
  const textColor = isDarkMode ? '#a8a29e' : '#78716c';

  return (
    <div id="organizer-dashboard" className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-emerald-800 rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 bg-white/20 rounded-lg backdrop-blur-xs">
              <ShieldCheck size={20} className="text-white" />
            </span>
            <span className="text-xs font-bold tracking-wider uppercase text-amber-200">
              Direction & Pilotage IndabaX Bénin 2026
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Supervision & Analyses en Temps Réel</h1>
          <p className="text-amber-100 text-sm mt-1 max-w-2xl">
            Taux de participation par session, synthèse des feedbacks, synchronisation Google Sheets et import massif de données.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl backdrop-blur-xs transition cursor-pointer border border-white/20"
          >
            <Upload size={15} />
            <span>Importer Données</span>
          </button>

          <button
            onClick={() => setIsSheetsSetupOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-stone-950 hover:bg-stone-100 text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
          >
            <FileSpreadsheet size={15} className="text-emerald-700" />
            <span>Base Google Sheet</span>
          </button>

          <button
            onClick={() => openScanner()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-stone-950 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
          >
            <QrCode size={15} />
            <span>Scanner QR</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Inscrits Confirmés</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
              <Users size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{totalRegistrations}</p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">100% accrédités</span>
        </div>

        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Taux de Présence Global</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{globalCheckInRate}%</p>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">{uniqueAttendeesCheckedIn} présents sur site</span>
        </div>

        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Scans de Présence</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{totalCheckIns}</p>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Émargements vérifiés</span>
        </div>

        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Satisfaction Moyenne</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
              <Sparkles size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{avgSatisfaction} / 5</p>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">{totalFeedbacks} avis collectés</span>
        </div>
      </div>

      {/* DYNAMIC RECHARTS CHART 1: Real-time Session Participation Rates */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="font-heading font-black text-stone-900 dark:text-white text-base">
                Taux de Remplissage & Présence par Session (Temps Réel)
              </h2>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Comparaison en direct du nombre d'auditeurs scannés par rapport à la capacité maximale des salles.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setChartViewFilter('all')}
              className={`px-3 py-1 rounded-lg transition ${chartViewFilter === 'all' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs' : 'text-stone-500 dark:text-stone-400'}`}
            >
              Tous
            </button>
            <button
              onClick={() => setChartViewFilter('day1')}
              className={`px-3 py-1 rounded-lg transition ${chartViewFilter === 'day1' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs' : 'text-stone-500 dark:text-stone-400'}`}
            >
              Jour 1
            </button>
            <button
              onClick={() => setChartViewFilter('day2')}
              className={`px-3 py-1 rounded-lg transition ${chartViewFilter === 'day2' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs' : 'text-stone-500 dark:text-stone-400'}`}
            >
              Jour 2
            </button>
            <button
              onClick={() => setChartViewFilter('day3')}
              className={`px-3 py-1 rounded-lg transition ${chartViewFilter === 'day3' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs' : 'text-stone-500 dark:text-stone-400'}`}
            >
              Jour 3
            </button>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sessionParticipationData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="name"
                stroke={textColor}
                fontSize={10}
                tickLine={false}
                angle={-20}
                textAnchor="end"
              />
              <YAxis stroke={textColor} fontSize={10} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-stone-950 text-white p-3 rounded-xl shadow-xl text-xs border border-stone-800">
                        <p className="font-bold text-amber-400">{data.fullName}</p>
                        <p className="text-[11px] text-stone-300">Salle : {data.room} • Avec {data.speaker}</p>
                        <div className="mt-2 pt-2 border-t border-stone-800 space-y-1 font-mono text-[11px]">
                          <p className="text-emerald-400">Présences réelles : <span className="font-bold">{data.presences}</span></p>
                          <p className="text-stone-400">Capacité salle : <span className="font-bold">{data.capacite}</span></p>
                          <p className="text-amber-300">Taux de remplissage : <span className="font-bold">{data.tauxRemplissage}%</span></p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }} />
              <Bar dataKey="presences" name="Présences Validées" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="capacite" name="Capacité Salle" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DYNAMIC RECHARTS CHART 2 & 3: Feedbacks Synthesis & Audience Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Feedback Synthesis Chart (Recharts) */}
        <div className="lg:col-span-8 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="font-heading font-black text-stone-900 dark:text-white text-base">
                  Synthèse des Feedbacks par Session (Recharts)
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Notes moyennes sur 5 : Évaluation globale, Pertinence du contenu & Clarté du speaker.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-full">
              {totalFeedbacks} retours
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={feedbackSynthesisData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="name"
                  stroke={textColor}
                  fontSize={10}
                  tickLine={false}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis domain={[0, 5]} stroke={textColor} fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-stone-950 text-white p-3 rounded-xl shadow-xl text-xs border border-stone-800">
                          <p className="font-bold text-amber-400">{data.fullName}</p>
                          <p className="text-[10px] text-stone-400">Par {data.speaker} ({data.evaluations} avis)</p>
                          <div className="mt-2 pt-2 border-t border-stone-800 space-y-1 font-mono text-[11px]">
                            <p className="text-amber-400">Note Globale : {data.noteGlobale} / 5</p>
                            <p className="text-emerald-400">Pertinence : {data.pertinence} / 5</p>
                            <p className="text-indigo-400">Clarté : {data.clarte} / 5</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }} />
                <Bar dataKey="noteGlobale" name="Note Globale (/5)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pertinence" name="Pertinence (/5)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clarte" name="Clarté (/5)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Audience Breakdown PieChart */}
        <div className="lg:col-span-4 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 mb-2 border-b border-stone-100 dark:border-stone-800">
              <PieIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-heading font-black text-stone-900 dark:text-white text-base">
                Répartition des Rôles
              </h3>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
              Composition globale de la communauté présente.
            </p>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {roleDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-[11px]">
            {roleDistributionData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span>
                <span className="text-stone-600 dark:text-stone-400 truncate">{d.name} : <strong className="text-stone-900 dark:text-stone-200">{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Google Sheets & Cloud Sync Control Center */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="font-bold text-stone-900 dark:text-white text-base">Base de données Google Sheet</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Lecture et écriture dans le classeur partagé par lien — sans Google Cloud ni Firebase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isSheetsLinked ? (
              <>
                <button
                  onClick={() => runSheetsAction(pushDataToSheets)}
                  disabled={isSyncing || !canWriteToSheets}
                  title={canWriteToSheets ? undefined : "Aucune voie d'écriture configurée"}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  <span>{isSyncing ? 'Envoi…' : 'Envoyer présences & feedbacks'}</span>
                </button>

                <button
                  onClick={() => runSheetsAction(() => importFromSheets('participants'))}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-50 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Importer participants</span>
                </button>

                {sheetsConfig.masterSheetUrl && (
                  <a
                    href={sheetsConfig.masterSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <ExternalLink size={14} />
                    <span>Ouvrir le classeur</span>
                  </a>
                )}
              </>
            ) : (
              <button
                onClick={() => setIsSheetsSetupOpen(true)}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet size={14} />
                <span>Lier le classeur Google Sheet</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick CSV Export Center */}
        <div className="mt-4 pt-2 flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Exportations de secours (CSV) :</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCsv('checkins')}
              className="flex items-center gap-1 px-3 py-1.5 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>Présences (CSV)</span>
            </button>
            <button
              onClick={() => exportToCsv('feedbacks')}
              className="flex items-center gap-1 px-3 py-1.5 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>Évaluations (CSV)</span>
            </button>
            <button
              onClick={() => exportToCsv('participants')}
              className="flex items-center gap-1 px-3 py-1.5 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>Participants (CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Quick Registration + Live Check-ins Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Registration Form */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400">
                <UserPlus size={18} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 dark:text-white text-sm">Enregistrement Express sur Place</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Émettre un badge instantané pour les retardataires ou invités VIP.</p>
              </div>
            </div>

            {justAddedBadge && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
                <span>{justAddedBadge}</span>
                <button onClick={() => setJustAddedBadge(null)} className="text-emerald-600 dark:text-emerald-400">×</button>
              </div>
            )}

            <form onSubmit={handleQuickRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Nom & Prénom</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean-Luc Mensah"
                  value={newAttendeeName}
                  onChange={(e) => setNewAttendeeName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="jeanluc@uac.bj"
                    value={newAttendeeEmail}
                    onChange={(e) => setNewAttendeeEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Rôle</label>
                  <select
                    value={newAttendeeRole}
                    onChange={(e) => setNewAttendeeRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-white"
                  >
                    <option value="attendee">Auditeur / Participant</option>
                    <option value="speaker">Conférencier</option>
                    <option value="volunteer">Volontaire</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Institution ou Entreprise</label>
                <input
                  type="text"
                  placeholder="Ex: Université d'Abomey-Calavi / Startup"
                  value={newAttendeeOrg}
                  onChange={(e) => setNewAttendeeOrg(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-stone-900 hover:bg-black dark:bg-stone-800 dark:hover:bg-stone-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>Générer le Billet & Badge</span>
              </button>
            </form>
          </div>
        </div>

        {/* Live Check-ins Feed */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Radio size={18} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 dark:text-white text-sm">Flux de Présence en Direct</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">{checkIns.length} enregistrements au total</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
            {checkIns.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-8">Aucun scan enregistré pour le moment.</p>
            ) : (
              checkIns.slice(0, 15).map((record) => (
                <div key={record.id} className="p-2.5 bg-stone-50/70 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/60 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                      {record.participantName.charAt(0)}
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-stone-900 dark:text-white truncate leading-tight">{record.participantName}</p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">{record.sessionTitle}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[10px] text-stone-400 block">
                      {new Date(record.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                      {record.room.split(' ')[0]}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

