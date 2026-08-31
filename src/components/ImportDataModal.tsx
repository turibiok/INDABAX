import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Users, 
  Calendar, 
  Bell, 
  Sparkles,
  ArrowRight,
  FileText,
  Trash2
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { Participant, Session, Announcement, ParticipantRole, SessionTrack, SessionType } from '../types';

interface ImportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportDataModal: React.FC<ImportDataModalProps> = ({ isOpen, onClose }) => {
  const { 
    participants, 
    sessions, 
    announcements,
    importParticipants,
    importSessions,
    importAnnouncements
  } = useEvent();

  const [activeImportType, setActiveImportType] = useState<'participants' | 'sessions' | 'announcements'>('participants');
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Sample CSV Templates
  const getSampleCsv = (type: 'participants' | 'sessions' | 'announcements'): string => {
    if (type === 'participants') {
      return `Nom,Email,Role,Institution,Poste,Ville,Pays,Interets
Dr. Kemi Adeyemi,kemi.adeyemi@unilag.edu.ng,speaker,University of Lagos,Professeure Associée,Lagos,Nigéria,"NLP, Bio-NLP, Fongbe AI"
Aristide Hounkpatin,aristide.h@epitech.bj,attendee,Epitech Bénin,Étudiant Master IA,Cotonou,Bénin,"Computer Vision, PyTorch"
Mireille Dossou,mireille.d@sèmècity.bj,volunteer,Sèmè City Open Lab,Chef de Projet Data,Cotonou,Bénin,"LLMs, Éthique IA"`;
    } else if (type === 'sessions') {
      return `Titre,Speaker,SpeakerTitle,SpeakerInstitution,Day,Date,StartTime,EndTime,Room,Track,Type,Level,Capacity,Description
"Atelier Pratique: Fine-Tuning LLMs en Langues Africaines","Dr. Kemi Adeyemi","AI Researcher","MILA / Masakhane",2,"2026-09-19","10:30","12:00","Lab Turing","Generative AI & LLMs","Workshop","Intermédiaire",80,"Session pratique sur l'adaptation des modèles LLaMA et Gemma aux langues locales (Fon, Yoruba)."
"Keynote: Souveraineté Numérique et IA en Afrique de l'Ouest","Pr. Aurel Zinsou","Directeur de Recherche","Institut des Sciences",1,"2026-09-18","09:00","10:15","Amphi Houdégbé","Keynote","Keynote","Tous niveaux",350,"Discours inaugural sur l'indépendance technologique et l'infrastructure de calcul en Afrique."`;
    } else {
      return `Titre,Contenu,Categorie,Priorite,Auteur
"Ouverture des Portes et Petit-Déjeuner Tech","Accueil et remise des badges dès 07h30 à l'Amphi Houdégbé.",LOGISTIQUE,urgent,"Comité d'Organisation"
"Hackathon IA Santé: Briefing Technique","Les équipes du Hackathon sont invitées en Salle Sèmè City à 14h00.",HACKATHON,normal,"Direction Scientifique"`;
    }
  };

  const handleDownloadTemplate = () => {
    const csv = getSampleCsv(activeImportType);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `modele_import_indabax_${activeImportType}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvToObjects = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error("Le fichier CSV doit contenir au moins un en-tête et une ligne de données.");
    }

    // Split headers respecting quotes
    const headers = parseCsvLine(lines[0]);
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length === 0) continue;
      const row: Record<string, string> = {};
      headers.forEach((h, index) => {
        row[h.trim().toLowerCase()] = values[index] ? values[index].trim() : '';
      });
      results.push(row);
    }
    return results;
  };

  const parseCsvLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  };

  const handleProcessInput = () => {
    setParseError(null);
    setImportSuccess(null);

    if (!inputText.trim()) {
      setParseError("Veuillez coller du texte CSV/JSON ou charger un fichier.");
      return;
    }

    try {
      let data: any[] = [];
      const trimmed = inputText.trim();

      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const json = JSON.parse(trimmed);
        data = Array.isArray(json) ? json : [json];
      } else {
        data = parseCsvToObjects(trimmed);
      }

      if (data.length === 0) {
        throw new Error("Aucun enregistrement valide n'a été extrait.");
      }

      setParsedData(data);
    } catch (e: any) {
      setParseError(e.message || "Erreur de format CSV/JSON. Vérifiez les virgules et guillemets.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
      // Auto parse
      try {
        let data: any[] = [];
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(content);
          data = Array.isArray(json) ? json : [json];
        } else {
          data = parseCsvToObjects(content);
        }
        setParsedData(data);
        setParseError(null);
      } catch (err: any) {
        setParseError("Fichier invalide : " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (parsedData.length === 0) return;

    if (activeImportType === 'participants') {
      const formatted: Participant[] = parsedData.map((row, idx) => ({
        id: row.id || `usr-imp-${Date.now()}-${idx}`,
        ticketNumber: row.ticketnumber || row.ticket || `INDABAX-BJ-2026-${Math.floor(2000 + Math.random() * 7000)}`,
        name: row.nom || row.name || 'Participant Anonyme',
        email: row.email || `participant${idx}@indabax.bj`,
        role: (row.role?.toLowerCase() as ParticipantRole) || 'attendee',
        institution: row.institution || row.organisation || 'IndabaX Bénin',
        position: row.poste || row.position || 'Auditeur',
        city: row.ville || row.city || 'Cotonou',
        country: row.pays || row.country || 'Bénin',
        avatarUrl: row.avatarurl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80`,
        bio: row.bio || 'Participant inscrit via importation.',
        interests: typeof row.interets === 'string' 
          ? row.interets.split(',').map((s: string) => s.trim()).filter(Boolean) 
          : ['IA Bénin', 'Deep Learning'],
        checkedInSessions: []
      }));

      importParticipants(formatted);
      setImportSuccess(`✅ ${formatted.length} participant(s) importé(s) avec succès !`);
    } else if (activeImportType === 'sessions') {
      const formatted: Session[] = parsedData.map((row, idx) => ({
        id: row.id || `ses-imp-${Date.now()}-${idx}`,
        title: row.titre || row.title || 'Session Sans Titre',
        speaker: row.speaker || row.conferencier || 'Intervenant IndabaX',
        speakerTitle: row.speakertitle || 'Expert IA',
        speakerInstitution: row.speakerinstitution || 'IndabaX Team',
        speakerPhoto: row.speakerphoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
        day: Number(row.day || row.jour) || 1,
        date: row.date || '2026-09-18',
        startTime: row.starttime || row.heuredebut || '09:00',
        endTime: row.endtime || row.heurefin || '10:30',
        room: row.room || row.salle || 'Amphi Houdégbé',
        track: (row.track as SessionTrack) || 'Fondamentaux ML',
        type: (row.type as SessionType) || 'Keynote',
        level: row.level || 'Tous niveaux',
        description: row.description || 'Description de session.',
        capacity: Number(row.capacity || row.capacite) || 150,
        currentAttendees: 0
      }));

      importSessions(formatted);
      setImportSuccess(`✅ ${formatted.length} session(s) ajoutée(s) au programme officiel !`);
    } else {
      const formatted: Announcement[] = parsedData.map((row, idx) => ({
        id: `ann-imp-${Date.now()}-${idx}`,
        title: row.titre || row.title || 'Annonce Officielle',
        content: row.contenu || row.content || '',
        category: (row.categorie?.toUpperCase() as any) || 'PROGRAMME',
        priority: (row.priorite?.toLowerCase() as any) || 'normal',
        authorName: row.auteur || row.author || 'Organisation IndabaX',
        authorRole: 'organizer',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
        timestamp: new Date().toISOString(),
        pinned: true,
        likes: 0,
        likedBy: [],
        comments: []
      }));

      importAnnouncements(formatted);
      setImportSuccess(`✅ ${formatted.length} annonce(s) diffusée(s) aux participants !`);
    }

    setParsedData([]);
    setInputText('');
    setFileName(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-emerald-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg">Centre d'Importation de Données</h2>
              <p className="text-xs text-amber-100">Ajout massif de participants, du programme ou des annonces.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-black/20 hover:bg-black/40 rounded-full text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 p-2 gap-2">
          <button
            onClick={() => { setActiveImportType('participants'); setParsedData([]); setParseError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeImportType === 'participants'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-xs border border-stone-200 dark:border-stone-700'
                : 'text-stone-600 dark:text-stone-400 hover:bg-white/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Participants ({participants.length})</span>
          </button>

          <button
            onClick={() => { setActiveImportType('sessions'); setParsedData([]); setParseError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeImportType === 'sessions'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-xs border border-stone-200 dark:border-stone-700'
                : 'text-stone-600 dark:text-stone-400 hover:bg-white/50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Programme ({sessions.length})</span>
          </button>

          <button
            onClick={() => { setActiveImportType('announcements'); setParsedData([]); setParseError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeImportType === 'announcements'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-xs border border-stone-200 dark:border-stone-700'
                : 'text-stone-600 dark:text-stone-400 hover:bg-white/50'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Annonces ({announcements.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {importSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
              <span>{importSuccess}</span>
              <button onClick={() => setImportSuccess(null)} className="text-emerald-600 dark:text-emerald-400">✕</button>
            </div>
          )}

          {parseError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Template Download Prompt */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span className="text-amber-900 dark:text-amber-200 font-semibold">
                Besoin du format exact de colonnes ?
              </span>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-xl font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger Modèle CSV</span>
            </button>
          </div>

          {/* File Upload Box */}
          <div className="border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-amber-500 rounded-2xl p-4 text-center bg-stone-50 dark:bg-stone-800/40 transition">
            <input
              type="file"
              id="file-import-upload"
              accept=".csv,.json,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="file-import-upload" className="cursor-pointer block">
              <Upload className="w-7 h-7 text-amber-600 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                {fileName ? `Fichier prêt : ${fileName}` : 'Cliquez pour sélectionner un fichier CSV ou JSON'}
              </p>
              <p className="text-[10px] text-stone-500 mt-0.5">Formats acceptés : .CSV, .JSON (UTF-8)</p>
            </label>
          </div>

          {/* Text Area for manual paste */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                Ou collez vos données textuelles (CSV ou JSON) :
              </label>
              {inputText && (
                <button
                  onClick={() => { setInputText(''); setParsedData([]); }}
                  className="text-[11px] text-stone-500 hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Effacer
                </button>
              )}
            </div>
            <textarea
              rows={4}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={getSampleCsv(activeImportType)}
              className="w-full font-mono text-[11px] bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleProcessInput}
              disabled={!inputText.trim()}
              className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-40 transition cursor-pointer"
            >
              Prévisualiser ({parsedData.length} détecté(s))
            </button>
          </div>

          {/* Data Preview Table */}
          {parsedData.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Données Prêtes à Être Injectées ({parsedData.length} lignes)
                </span>
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  Validation OK
                </span>
              </div>

              <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                    <tr>
                      {Object.keys(parsedData[0] || {}).slice(0, 4).map(key => (
                        <th key={key} className="p-2 font-bold uppercase">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-800 dark:text-stone-200">
                    {parsedData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                        {Object.values(row).slice(0, 4).map((val: any, vi) => (
                          <td key={vi} className="p-2 truncate max-w-[120px]">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 5 && (
                <p className="text-[10px] text-stone-500 text-right">+ {parsedData.length - 5} autres enregistrements</p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 text-xs font-semibold"
          >
            Fermer
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={parsedData.length === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-40 transition flex items-center gap-2 cursor-pointer"
          >
            <span>Valider et Importer ({parsedData.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
