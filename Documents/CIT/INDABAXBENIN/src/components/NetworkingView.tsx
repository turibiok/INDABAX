import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Sparkles, 
  QrCode, 
  UserPlus, 
  Check, 
  Mail, 
  Building, 
  MapPin, 
  Linkedin, 
  Github, 
  MessageSquare, 
  Download, 
  Zap, 
  Bot,
  Filter,
  Send
} from 'lucide-react';
import { Participant, AIMatchmakingRecommendation } from '../types';
import { useEvent } from '../context/EventContext';

export const NetworkingView: React.FC<{ onOpenQRScanner: () => void }> = ({ onOpenQRScanner }) => {
  const { 
    participants, 
    currentUser, 
    connections, 
    addConnection 
  } = useEvent();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterRole, setSelectedFilterRole] = useState('all');
  const [selectedInterestFilter, setSelectedInterestFilter] = useState('all');
  const [aiMatchmaking, setAiMatchmaking] = useState<{
    recommendations: AIMatchmakingRecommendation[];
    summaryTip?: string;
  } | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [customNotes, setCustomNotes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'directory' | 'my-connections' | 'ai-match'>('directory');

  // Filter participants (exclude self from directory)
  const otherParticipants = participants.filter(p => p.id !== currentUser.id);

  const filteredParticipants = otherParticipants.filter(p => {
    if (selectedFilterRole !== 'all' && p.role !== selectedFilterRole) return false;
    if (selectedInterestFilter !== 'all' && !p.interests.some(i => i.toLowerCase().includes(selectedInterestFilter.toLowerCase()))) return false;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchInst = p.institution.toLowerCase().includes(q);
      const matchPos = p.position.toLowerCase().includes(q);
      const matchInterests = p.interests.some(i => i.toLowerCase().includes(q));
      if (!matchName && !matchInst && !matchPos && !matchInterests) return false;
    }
    return true;
  });

  // Call Gemini AI Matchmaker endpoint
  const handleGenerateAIMatchmaking = async () => {
    setIsLoadingAI(true);
    setActiveTab('ai-match');
    try {
      const res = await fetch('/api/ai/matchmake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile: currentUser,
          attendees: otherParticipants
        })
      });

      if (!res.ok) throw new Error("Erreur serveur lors du matchmaking.");
      const data = await res.json();
      setAiMatchmaking(data);
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la recommandation IA : " + err.message);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Export vCard for my connections
  const handleExportVCard = () => {
    if (connections.length === 0) {
      alert("Vous n'avez pas encore de connexions enregistrées.");
      return;
    }

    let vcfString = "";
    connections.forEach(c => {
      vcfString += "BEGIN:VCARD\r\nVERSION:3.0\r\n";
      vcfString += `FN:${c.partnerName}\r\n`;
      vcfString += `EMAIL:${c.partnerEmail}\r\n`;
      vcfString += `ORG:${c.partnerInstitution}\r\n`;
      vcfString += `TITLE:${c.partnerRole}\r\n`;
      if (c.notes) vcfString += `NOTE:Rencontré à IndabaX Bénin 2026. Note: ${c.notes}\r\n`;
      vcfString += "END:VCARD\r\n\r\n";
    });

    const blob = new Blob([vcfString], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `indabax-benin-contacts-${new Date().toISOString().slice(0, 10)}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-stone-900 via-stone-850 to-emerald-950 border border-stone-800 p-6 sm:p-8 shadow-xl text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold mb-3">
              <Users className="w-3.5 h-3.5" />
              Réseautage & Échange Scientifique
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-white">
              Connectez-vous avec la Communauté <span className="text-amber-400">IA Bénin</span>
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm mt-1 leading-relaxed">
              Échangez vos badges par QR code, trouvez des collaborateurs pour vos projets de recherche et découvrez des mentors grâce au Matchmaker IA.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleGenerateAIMatchmaking}
              disabled={isLoadingAI}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/30 transition cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isLoadingAI ? 'animate-spin' : ''}`} />
              <span>{isLoadingAI ? 'Analyse Gemini...' : 'Matchmaking IA'}</span>
            </button>

            <button
              onClick={onOpenQRScanner}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Scanner un Badge</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'directory' 
              ? 'bg-stone-900 text-white shadow-xs' 
              : 'text-stone-600 hover:text-stone-900 bg-white border border-stone-200'
          }`}
        >
          Annuaire des Participants ({otherParticipants.length})
        </button>

        <button
          onClick={() => setActiveTab('my-connections')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === 'my-connections' 
              ? 'bg-stone-900 text-white shadow-xs' 
              : 'text-stone-600 hover:text-stone-900 bg-white border border-stone-200'
          }`}
        >
          <span>Mes Contacts Enregistrés</span>
          <span className="bg-amber-400 text-stone-950 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
            {connections.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ai-match')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === 'ai-match' 
              ? 'bg-purple-700 text-white shadow-xs' 
              : 'text-purple-700 hover:text-purple-900 bg-purple-50 border border-purple-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>Suggestions IA</span>
        </button>
      </div>

      {/* Tab Content: 1. DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, laboratoire, compétence..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedFilterRole}
                onChange={e => setSelectedFilterRole(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-700 font-semibold focus:outline-none focus:border-emerald-600"
              >
                <option value="all">Tous les rôles</option>
                <option value="attendee">Participants</option>
                <option value="speaker">Speakers</option>
                <option value="organizer">Organisateurs</option>
                <option value="volunteer">Volontaires</option>
              </select>
            </div>
          </div>

          {/* Attendees Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredParticipants.map((p) => {
              const isConnected = connections.some(c => c.partnerId === p.id);

              return (
                <div
                  key={p.id}
                  className="bg-white border border-stone-200 rounded-2xl p-5 hover:border-emerald-500/50 hover:shadow-md transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.avatarUrl}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-stone-100 shadow-xs"
                        />
                        <div>
                          <h3 className="font-heading font-black text-sm text-stone-900">{p.name}</h3>
                          <p className="text-[11px] text-amber-700 font-bold">{p.position}</p>
                          <p className="text-[10px] text-stone-500 truncate max-w-[170px]">{p.institution}</p>
                        </div>
                      </div>

                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                        p.role === 'speaker' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        p.role === 'organizer' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                        p.role === 'volunteer' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-stone-100 text-stone-700 border-stone-200'
                      }`}>
                        {p.role}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {p.bio}
                    </p>

                    {/* Interests tags */}
                    <div className="flex flex-wrap gap-1">
                      {p.interests.map((tag, idx) => (
                        <span key={idx} className="text-[10px] bg-stone-50 text-stone-600 px-2 py-0.5 rounded border border-stone-200 font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {p.linkedin && (
                        <a href={p.linkedin} target="_blank" rel="noreferrer" className="text-stone-400 hover:text-blue-600 transition">
                          <Linkedin className="w-4 h-4" />
                        </a>
                      )}
                      {p.github && (
                        <a href={p.github} target="_blank" rel="noreferrer" className="text-stone-400 hover:text-stone-900 transition">
                          <Github className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <button
                      onClick={() => addConnection(p, customNotes[p.id] || "")}
                      disabled={isConnected}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isConnected
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                          : 'bg-amber-400 hover:bg-amber-500 text-stone-950 shadow-xs'
                      }`}
                    >
                      {isConnected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Connecté</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Se Connecter</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content: 2. MY SAVED CONNECTIONS */}
      {activeTab === 'my-connections' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
            <div>
              <h3 className="font-heading font-black text-sm text-stone-900">Mon Carnet de Contacts IndabaX</h3>
              <p className="text-xs text-stone-500">{connections.length} contacts sauvegardés durant l'événement.</p>
            </div>

            {connections.length > 0 && (
              <button
                onClick={handleExportVCard}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter vCard (.vcf)</span>
              </button>
            )}
          </div>

          {connections.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-xs">
              <Users className="w-12 h-12 text-stone-400 mx-auto mb-3" />
              <h4 className="font-bold text-stone-900 text-sm mb-1">Aucun contact pour l'instant</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mb-4">
                Scannez le badge QR d'un autre participant ou cliquez sur "Se Connecter" dans l'annuaire pour enregistrer leurs coordonnées.
              </p>
              <button
                onClick={() => setActiveTab('directory')}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Parcourir l'annuaire
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connections.map((c) => (
                <div key={c.id} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-heading font-black text-base text-stone-900">{c.partnerName}</h4>
                      <p className="text-xs text-amber-700 font-bold">{c.partnerRole.toUpperCase()}</p>
                      <p className="text-xs text-stone-700">{c.partnerInstitution}</p>
                      <p className="text-[11px] text-stone-500 font-mono mt-1">{c.partnerEmail}</p>
                    </div>
                    <span className="text-[10px] text-stone-400 font-medium">{new Date(c.timestamp).toLocaleDateString()}</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {c.partnerInterests.map((t, idx) => (
                      <span key={idx} className="text-[10px] bg-stone-50 text-stone-600 px-2 py-0.5 rounded border border-stone-200 font-medium">
                        {t}
                      </span>
                    ))}
                  </div>

                  {c.notes && (
                    <p className="text-xs bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-stone-700 italic">
                      Note : "{c.notes}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: 3. AI MATCHMAKER SUGGESTIONS */}
      {activeTab === 'ai-match' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 border border-purple-200 p-6 rounded-3xl space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
              <Bot className="w-4 h-4" />
              Recommandations Intelligentes Gemini
            </div>
            <h3 className="text-xl font-heading font-black text-stone-900">
              Suggestions de Synergies de Recherche pour vous ({currentUser.name})
            </h3>
            <p className="text-xs text-stone-600 max-w-2xl leading-relaxed">
              Basé sur vos centres d'intérêt (<strong className="text-emerald-800">{currentUser.interests.join(', ')}</strong>), l'IA a sélectionné les participants et chercheurs les plus pertinents avec des amorces de conversation prêtes à l'emploi.
            </p>
          </div>

          {isLoadingAI ? (
            <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-stone-200">
              <Sparkles className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-stone-900">Analyse des profils et calcul des affinités scientifiques en cours...</p>
              <p className="text-xs text-stone-500">Gemini examine les sujets de recherche, NLP, Computer Vision et MLOps.</p>
            </div>
          ) : aiMatchmaking?.recommendations ? (
            <div className="space-y-4">
              {aiMatchmaking.summaryTip && (
                <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-xs text-amber-900 font-medium">
                  <span className="font-bold">Conseil Networking : </span>
                  {aiMatchmaking.summaryTip}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiMatchmaking.recommendations.map((rec, idx) => {
                  const partner = participants.find(p => p.id === rec.attendeeId || p.name === rec.name);
                  const isConnected = partner && connections.some(c => c.partnerId === partner.id);

                  return (
                    <div key={idx} className="bg-white border border-purple-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xs">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="font-heading font-black text-base text-stone-900">{rec.name}</h4>
                          <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full font-bold">
                            Affinité IA Haute
                          </span>
                        </div>

                        {partner && (
                          <p className="text-xs text-stone-500">{partner.position} • {partner.institution}</p>
                        )}

                        <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs text-stone-700">
                          <span className="font-bold text-purple-800">Pourquoi échanger : </span>
                          {rec.reason}
                        </div>

                        <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200 text-xs text-purple-950">
                          <span className="font-bold text-purple-900 flex items-center gap-1 mb-1">
                            <MessageSquare className="w-3.5 h-3.5 text-purple-700" /> Phrase d'accroche suggérée :
                          </span>
                          "{rec.icebreaker}"
                        </div>
                      </div>

                      {partner && (
                        <div className="pt-2 border-t border-stone-100">
                          <button
                            onClick={() => addConnection(partner, `Match IA: ${rec.reason}`)}
                            disabled={isConnected}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              isConnected 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white shadow-xs'
                            }`}
                          >
                            {isConnected ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                            <span>{isConnected ? 'Déjà dans mes contacts' : 'Ajouter à mes contacts'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center space-y-4 shadow-xs">
              <Bot className="w-12 h-12 text-purple-600 mx-auto" />
              <h4 className="font-bold text-stone-900 text-base">Prêt pour votre recommandation personnalisée ?</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Cliquez ci-dessous pour lancer l'analyse Gemini de vos intérêts et obtenir des suggestions ciblées.
              </p>
              <button
                onClick={handleGenerateAIMatchmaking}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
              >
                Générer les suggestions IA
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
