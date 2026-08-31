import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  QrCode,
  Users,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  PhoneCall,
  Send,
  Plus,
  ShieldCheck,
  Radio,
  Layers,
  Sparkles,
  LifeBuoy
} from 'lucide-react';
import { useEvent } from '../../context/EventContext';

export const VolunteerDashboard: React.FC = () => {
  const {
    currentUser,
    sessions,
    checkIns,
    volunteerLogs,
    addVolunteerLog,
    resolveVolunteerLog,
    setActiveTab,
    openScanner
  } = useEvent();

  const [incidentRoom, setIncidentRoom] = useState(sessions[0]?.room || 'Amphithéâtre Houdégbé (UAC)');
  const [incidentMessage, setIncidentMessage] = useState('');
  const [incidentType, setIncidentType] = useState<'incident' | 'request' | 'capacity_alert'>('request');
  const [incidentSeverity, setIncidentSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [submittedAlert, setSubmittedAlert] = useState(false);

  const myCheckInsCount = checkIns.filter(c =>
    c.scannedBy.toLowerCase().includes(currentUser.name.toLowerCase()) ||
    c.scannedBy.includes('Volontaire')
  ).length;

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentMessage.trim()) return;

    addVolunteerLog({
      volunteerId: currentUser.id,
      volunteerName: currentUser.name,
      room: incidentRoom,
      type: incidentType,
      severity: incidentSeverity,
      message: incidentMessage.trim()
    });

    setIncidentMessage('');
    setSubmittedAlert(true);
    setTimeout(() => setSubmittedAlert(false), 4000);
  };

  return (
    <div id="volunteer-dashboard" className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 bg-white/20 rounded-lg backdrop-blur-xs">
              <LifeBuoy size={20} className="text-white" />
            </span>
            <span className="text-xs font-bold tracking-wider uppercase text-emerald-200">
              Espace Accueil & Volontariat
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Poste d'Accueil & Orientation</h1>
          <p className="text-emerald-100 text-sm mt-1 max-w-2xl">
            Scanner les badges des participants, surveiller la saturation des salles et signaler les besoins logistiques en temps réel.
          </p>
        </div>

        <button
          onClick={() => openScanner()}
          className="flex items-center gap-2 px-5 py-3 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-2xl shadow-lg transition-all active:scale-95 shrink-0"
        >
          <QrCode size={18} className="text-emerald-400" />
          <span>Ouvrir Scanner QR Code</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Badges Scannés par l'Équipe</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">{checkIns.length}</p>
          <span className="text-[11px] text-stone-500 font-medium">{myCheckInsCount} scans sur ce poste</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Salles Actives</span>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <MapPin size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">4 Salles</p>
          <span className="text-[11px] text-emerald-600 font-medium">Flux régulier</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500">Signalements Transmis</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <AlertTriangle size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900">{volunteerLogs.length}</p>
          <span className="text-[11px] text-stone-500 font-medium">Dont {volunteerLogs.filter(l => l.status === 'open').length} en cours</span>
        </div>
      </div>

      {/* Room Saturation Gauge (Direct Traffic) */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-stone-900 text-base flex items-center gap-2">
            <Radio size={18} className="text-emerald-600 animate-pulse" />
            <span>Jauge de Remplissage des Salles (Live)</span>
          </h2>
          <span className="text-xs text-stone-400">Pour orienter les participants</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sessions.slice(0, 4).map((ses) => {
            const pct = Math.round((ses.currentAttendees / ses.capacity) * 100);
            const statusColor = pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
            const statusBadge = pct >= 85 ? 'Saturé' : pct >= 60 ? 'Bien rempli' : 'Places disponibles';

            return (
              <div key={ses.id} className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-700 truncate max-w-[120px]">{ses.room.split(' ')[0]}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    pct >= 85 ? 'bg-red-100 text-red-800' : pct >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {statusBadge}
                  </span>
                </div>

                <p className="text-xs text-stone-900 font-semibold truncate">{ses.title}</p>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-stone-500">
                    <span>{ses.currentAttendees} / {ses.capacity} places</span>
                    <span className="font-bold">{pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${statusColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Quick Log/Incident Reporter + Emergency Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incident / Needs Reporter */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Signaler un Problème ou Besoin Logistique</h3>
                <p className="text-xs text-stone-500">Notification immédiate aux organisateurs en régie.</p>
              </div>
            </div>

            {submittedAlert && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
                ✅ Signalement transmis au comité d'organisation !
              </div>
            )}

            <form onSubmit={handleSubmitReport} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Salle / Emplacement</label>
                  <select
                    value={incidentRoom}
                    onChange={(e) => setIncidentRoom(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Amphithéâtre Houdégbé (UAC)">Amphi Houdégbé</option>
                    <option value="Lab IA - Salle Turing">Lab IA Turing</option>
                    <option value="Salle des Thèses 1">Salle des Thèses 1</option>
                    <option value={"Hall d'Exposition & Posters"}>Hall d'Exposition</option>
                    <option value="Desk Accueil Extérieur">Desk Accueil</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Type de Requête</label>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="request">Besoin Matériel / Multiprises</option>
                    <option value="incident">Incident Technique / Micro</option>
                    <option value="capacity_alert">Salle Débordée / Saturation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Message d'alerte</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Manque de 15 chaises et 3 multiprises au Lab Turing..."
                  value={incidentMessage}
                  onChange={(e) => setIncidentMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Send size={14} />
                <span>Transmettre l'Alerte aux Organisateurs</span>
              </button>
            </form>
          </div>
        </div>

        {/* Emergency Contacts & Logs History */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <PhoneCall size={18} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Lignes Directes d'Urgence</h3>
                <p className="text-xs text-stone-500">Numéros à contacter en cas d'urgence logistique ou médicale.</p>
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-stone-900">Coordinateur Général IndabaX</p>
                  <p className="text-stone-500">Mahuvi Vituribio K.</p>
                </div>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                  +229 97 00 11 22
                </span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-stone-900">Régie Technique & Vidéoprojection</p>
                  <p className="text-stone-500">Équipe Sèmè City / UAC</p>
                </div>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
                  +229 96 11 22 33
                </span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-stone-900">Poste Médical & Premiers Soins</p>
                  <p className="text-stone-500">Infirmerie Campus Calavi</p>
                </div>
                <span className="font-mono font-bold text-red-700 bg-red-50 px-2 py-1 rounded-md">
                  +229 95 44 55 66
                </span>
              </div>
            </div>

            {/* Resolved vs Open Logs */}
            <div className="pt-2 border-t border-stone-100">
              <span className="text-[11px] font-semibold text-stone-500 block mb-2">Historique récent des signalements :</span>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                {volunteerLogs.map(log => (
                  <div key={log.id} className="p-2 bg-stone-50/80 rounded-lg text-[11px] flex items-center justify-between">
                    <span className="truncate max-w-[200px] text-stone-700">{log.message}</span>
                    {log.status === 'resolved' ? (
                      <span className="text-emerald-600 font-bold">Résolu</span>
                    ) : (
                      <button
                        onClick={() => resolveVolunteerLog(log.id)}
                        className="text-amber-600 font-bold hover:underline"
                      >
                        Marquer résolu
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
