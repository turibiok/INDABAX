import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  User, 
  Mail, 
  Building, 
  MapPin, 
  Sparkles, 
  Edit3, 
  Save, 
  Download, 
  Share2, 
  Github, 
  Linkedin, 
  Twitter, 
  CheckCircle2, 
  Calendar,
  Layers,
  Award,
  QrCode,
  Maximize2,
  HardDrive,
  FileText,
  Loader2,
  Printer
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { ParticipantRole } from '../types';
import { downloadBadgePdf } from '../services/badgePdfService';

export const MyBadgeView: React.FC = () => {
  const { currentUser, updateUserProfile, sessions, checkIns } = useEvent();

  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser.name,
    email: currentUser.email,
    institution: currentUser.institution,
    position: currentUser.position,
    bio: currentUser.bio,
    city: currentUser.city,
    country: currentUser.country,
    role: currentUser.role,
    interests: currentUser.interests.join(', '),
    github: currentUser.github || '',
    linkedin: currentUser.linkedin || '',
    twitter: currentUser.twitter || '',
  });

  const [isFullscreenQR, setIsFullscreenQR] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const availableInterests = [
    'NLP', 'Fongbe AI', 'Computer Vision', 'LLMs', 'Santé & IA', 
    'Agriculture', 'MLOps', 'PyTorch', 'Éthique IA', 'Robotics', 'Data Science'
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name: formData.name,
      email: formData.email,
      institution: formData.institution,
      position: formData.position,
      bio: formData.bio,
      city: formData.city,
      country: formData.country,
      role: formData.role as ParticipantRole,
      interests: formData.interests.split(',').map(s => s.trim()).filter(Boolean),
      github: formData.github,
      linkedin: formData.linkedin,
      twitter: formData.twitter,
    });
    setIsEditing(false);
    setSaveToast('Profil et Badge IndabaX mis à jour !');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const toggleInterest = (tag: string) => {
    const currentList = formData.interests.split(',').map(s => s.trim()).filter(Boolean);
    let newList;
    if (currentList.includes(tag)) {
      newList = currentList.filter(t => t !== tag);
    } else {
      newList = [...currentList, tag];
    }
    setFormData({ ...formData, interests: newList.join(', ') });
  };

  // QR Code payload contains verified attendee ticket
  const qrPayload = JSON.stringify({
    ticketNumber: currentUser.ticketNumber,
    name: currentUser.name,
    email: currentUser.email,
    id: currentUser.id,
    role: currentUser.role,
    institution: currentUser.institution,
    event: "IndabaX Benin 2026"
  });

  // Calculate my checked-in sessions
  const myCheckedInRecords = checkIns.filter(
    c => c.participantId === currentUser.id || c.participantEmail === currentUser.email
  );

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await downloadBadgePdf('physical-badge-card', currentUser);
      setSaveToast('Badge PDF officiel généré et téléchargé !');
      setTimeout(() => setSaveToast(null), 3500);
    } catch (err) {
      console.error('Error exporting badge PDF', err);
      alert('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Le badge est genere localement puis Google Drive est ouvert pour le deposer :
  // aucune autorisation OAuth n'est necessaire.
  const handleSaveToDrive = async () => {
    await handleDownloadPdf();
    window.open('https://drive.google.com/drive/my-drive', '_blank', 'noopener,noreferrer');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-800 border border-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span className="text-xs font-bold">{saveToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-xs font-bold mb-2">
            <Award className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            Pass Officiel d'Accès IndabaX Bénin
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-stone-900 dark:text-white">
            Mon Badge Digital & Profil
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300">
            Téléchargez votre badge en PDF haute définition ou présentez ce QR code à l'entrée.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{isEditing ? 'Fermer Édition' : 'Modifier Profil'}</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
            title="Télécharger le badge en fichier PDF imprimable"
          >
            {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Télécharger PDF</span>
          </button>

          <button
            onClick={handleSaveToDrive}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-700/20 cursor-pointer"
            title="Stocker et archiver le badge dans Google Drive"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Google Drive</span>
          </button>

          <button
            onClick={handlePrint}
            className="p-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl transition cursor-pointer"
            title="Imprimer directement"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Physical Badge Card Design */}
        <div className="lg:col-span-5 flex flex-col items-center">
          
          {/* Lanyard Top Attachment */}
          <div className="w-28 h-6 bg-stone-800 rounded-t-xl border-t border-x border-stone-700 flex items-center justify-center -mb-1 z-10 shadow-xs">
            <div className="w-12 h-2.5 bg-stone-950 rounded-full border border-stone-700"></div>
          </div>

          {/* Badge Physical Card with vibrant African energy */}
          <div 
            id="physical-badge-card"
            className="w-full max-w-sm bg-gradient-to-b from-stone-900 via-stone-900 to-emerald-950 border-2 border-amber-400/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center group text-white"
          >
            
            {/* Ambient glows */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-amber-400/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none"></div>

            {/* Badge Top Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center font-black text-stone-950 text-xs shadow-xs">
                  IX
                </div>
                <div className="text-left">
                  <p className="text-xs font-heading font-black tracking-tight text-white">INDABAX BÉNIN</p>
                  <p className="text-[9px] text-amber-300 font-mono font-bold">EDITION 2026</p>
                </div>
              </div>

              {/* Role Badge */}
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                currentUser.role === 'organizer' 
                  ? 'bg-amber-400 text-stone-950 border-amber-300' 
                  : currentUser.role === 'speaker'
                  ? 'bg-purple-600 text-white border-purple-400'
                  : currentUser.role === 'volunteer'
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-stone-800 text-amber-300 border-stone-700'
              }`}>
                {currentUser.role}
              </span>
            </div>

            {/* Avatar & Name */}
            <div className="my-3">
              <div className="relative inline-block mb-3">
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-24 h-24 rounded-2xl object-cover ring-4 ring-amber-400/60 mx-auto shadow-lg"
                />
                <span className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 rounded-full border-2 border-stone-900 flex items-center justify-center text-[10px] text-white font-bold">
                  ✓
                </span>
              </div>
              
              <h2 className="text-xl font-heading font-black text-white">{currentUser.name}</h2>
              <p className="text-xs font-semibold text-amber-300 mt-0.5">{currentUser.position}</p>
              <p className="text-[11px] text-stone-300">{currentUser.institution}</p>
            </div>

            {/* Personalized QR Code for Scanning */}
            <div className="bg-white p-3.5 rounded-2xl inline-block my-3 shadow-xl relative cursor-pointer hover:scale-105 transition" onClick={() => setIsFullscreenQR(true)}>
              <QRCodeSVG
                value={qrPayload}
                size={140}
                level="H"
                includeMargin={false}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-stone-950/80 rounded-2xl transition text-white text-[11px] font-bold gap-1">
                <Maximize2 className="w-4 h-4" /> Agrandir
              </div>
            </div>

            <p className="text-[11px] font-mono text-amber-300 font-bold tracking-wider">
              {currentUser.ticketNumber}
            </p>
            
            {/* Interests Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 pt-3 border-t border-stone-800">
              {currentUser.interests.slice(0, 4).map((tag, idx) => (
                <span key={idx} className="text-[10px] bg-stone-800 text-stone-200 px-2 py-0.5 rounded-md border border-stone-700 font-medium">
                  {tag}
                </span>
              ))}
            </div>

            {/* Bottom Bar: Location & Dates */}
            <div className="mt-4 pt-3 border-t border-stone-800 text-[10px] text-stone-400 flex items-center justify-between font-semibold">
              <span>Cotonou, Bénin</span>
              <span>18-20 Sept. 2026</span>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile Form or Profile Details */}
        <div className="lg:col-span-7 space-y-6">
          
          {isEditing ? (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100 dark:border-stone-800">
                <h3 className="font-heading font-black text-lg text-stone-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Modifier mes informations
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-300 font-semibold"
                >
                  Annuler
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">Nom complet :</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-stone-900 dark:text-white focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">Email :</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-stone-900 dark:text-white focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">Institution / Université :</label>
                    <input
                      type="text"
                      value={formData.institution}
                      onChange={e => setFormData({ ...formData, institution: e.target.value })}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-stone-900 dark:text-white focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">Poste / Rôle actuel :</label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={e => setFormData({ ...formData, position: e.target.value })}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-stone-900 dark:text-white focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">Bio / Présentation de recherche :</label>
                  <textarea
                    rows={3}
                    value={formData.bio}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-stone-900 dark:text-white focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {/* Quick Tags Selector */}
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">Centres d'intérêt en IA :</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {availableInterests.map((tag) => {
                      const isSelected = formData.interests.split(',').map(s => s.trim()).includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleInterest(tag)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                            isSelected
                              ? 'bg-amber-400 text-stone-950 border-amber-500 font-bold shadow-xs'
                              : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}{tag}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={formData.interests}
                    onChange={e => setFormData({ ...formData, interests: e.target.value })}
                    placeholder="Séparez par des virgules"
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-stone-900 dark:text-white text-xs"
                  />
                </div>

                {/* Social Links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">GitHub :</label>
                    <input
                      type="text"
                      placeholder="https://github.com/..."
                      value={formData.github}
                      onChange={e => setFormData({ ...formData, github: e.target.value })}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-stone-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">LinkedIn :</label>
                    <input
                      type="text"
                      placeholder="https://linkedin.com/in/..."
                      value={formData.linkedin}
                      onChange={e => setFormData({ ...formData, linkedin: e.target.value })}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-stone-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">Rôle :</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value as ParticipantRole })}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-emerald-800 dark:text-emerald-400 font-bold"
                    >
                      <option value="attendee">Participant (Attendee)</option>
                      <option value="speaker">Conférencier (Speaker)</option>
                      <option value="organizer">Organisateur</option>
                      <option value="volunteer">Volontaire</option>
                      <option value="sponsor">Sponsor / Partenaire</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Enregistrer les modifications
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Profile Details Card */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                  <h3 className="font-heading font-black text-base text-stone-900 dark:text-white">
                    Biographie & Présentation
                  </h3>
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-mono font-bold">
                    {currentUser.country} ({currentUser.city})
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                  {currentUser.bio}
                </p>

                {/* Social links row */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {currentUser.linkedin && (
                    <a
                      href={currentUser.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold"
                    >
                      <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                      <span>LinkedIn</span>
                    </a>
                  )}
                  {currentUser.github && (
                    <a
                      href={currentUser.github}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold"
                    >
                      <Github className="w-3.5 h-3.5 text-stone-900 dark:text-white" />
                      <span>GitHub</span>
                    </a>
                  )}
                </div>
              </div>

              {/* My Checked-in Sessions List */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-heading font-black text-base text-stone-900 dark:text-white">
                      Mes Émargements Validés ({myCheckedInRecords.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Présences confirmées</span>
                </div>

                {myCheckedInRecords.length === 0 ? (
                  <div className="text-center py-6 text-stone-500 dark:text-stone-400 text-xs">
                    Vous n'avez pas encore été scanné à une session. Présentez votre QR Code aux portes d'entrée !
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {myCheckedInRecords.map((rec) => (
                      <div key={rec.id} className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-stone-900 dark:text-white">{rec.sessionTitle}</p>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400">{rec.room} • {new Date(rec.timestamp).toLocaleString()}</p>
                        </div>
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          Validé ✓
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Fullscreen High-Contrast QR Code for scanning */}
      {isFullscreenQR && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setIsFullscreenQR(false)}>
          <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl text-center max-w-sm w-full shadow-2xl text-stone-900 dark:text-white border border-stone-200 dark:border-stone-800" onClick={e => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-400 mb-1">IndabaX Bénin 2026 - Pass</p>
            <h3 className="text-lg font-black text-stone-900 dark:text-white mb-3">{currentUser.name}</h3>
            
            <div className="inline-block p-3 border-2 border-stone-900 dark:border-amber-400 rounded-2xl mb-3 bg-white">
              <QRCodeSVG value={qrPayload} size={240} level="H" />
            </div>

            <p className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 mb-4">{currentUser.ticketNumber}</p>
            
            <button
              onClick={() => setIsFullscreenQR(false)}
              className="w-full py-2.5 bg-stone-900 dark:bg-stone-800 hover:bg-stone-800 dark:hover:bg-stone-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Fermer le plein écran
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

