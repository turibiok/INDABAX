import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Pin,
  Heart,
  MessageSquare,
  Send,
  Plus,
  X,
  AlertCircle,
  Calendar,
  Truck,
  Sparkles,
  Trophy,
  Users,
  ShieldAlert,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { AnnouncementCategory, Announcement } from '../types';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

export const AnnouncementsView: React.FC = () => {
  const {
    announcements,
    currentUser,
    capabilities,
    socialWarning,
    likeAnnouncement,
    addAnnouncementComment,
    addAnnouncement,
    deleteAnnouncement,
    togglePinAnnouncement
  } = useEvent();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Announcement Form State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<AnnouncementCategory>('PROGRAMME');
  const [newPriority, setNewPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [newPinned, setNewPinned] = useState(false);
  const [newAudience, setNewAudience] = useState<'all' | 'speakers' | 'volunteers' | 'attendees'>('all');

  /*
   * Le droit de publier vient du serveur, pas d'une liste de rôles tenue ici.
   *
   * Cette liste était fausse dans les deux sens : elle cachait le bouton aux
   * Super-Admins, qui ont le droit de diffuser, et le montrait aux
   * conférenciers et volontaires, dont la publication était refusée par le
   * serveur. Un bouton qui mène à un refus est pire que pas de bouton.
   */
  const canPublish = capabilities.canBroadcast;
  const canModerate = capabilities.canManageContent;

  const categories = [
    { key: 'ALL', label: 'Toutes', icon: Bell },
    { key: 'URGENT', label: 'Urgences', icon: AlertCircle, color: 'text-red-500' },
    { key: 'PROGRAMME', label: 'Programme & Sessions', icon: Calendar, color: 'text-amber-500' },
    { key: 'LOGISTIQUE', label: 'Logistique & Navettes', icon: Truck, color: 'text-blue-500' },
    { key: 'KEYNOTE', label: 'Keynotes & Invités', icon: Sparkles, color: 'text-purple-500' },
    { key: 'HACKATHON', label: 'Hackathon & Prix', icon: Trophy, color: 'text-emerald-500' }
  ];

  const filteredAnnouncements = announcements.filter(ann => {
    if (selectedCategory !== 'ALL' && ann.category !== selectedCategory) return false;
    return true;
  }).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const toggleComments = (annId: string) => {
    setExpandedComments(prev => ({ ...prev, [annId]: !prev[annId] }));
  };

  const handleSendComment = (annId: string) => {
    const text = commentInputs[annId]?.trim();
    if (!text) return;
    addAnnouncementComment(annId, text);
    setCommentInputs(prev => ({ ...prev, [annId]: '' }));
    setExpandedComments(prev => ({ ...prev, [annId]: true }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    addAnnouncement({
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      priority: newPriority,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorAvatar: currentUser.avatarUrl,
      pinned: newPinned,
      targetAudience: newAudience
    });

    setNewTitle('');
    setNewContent('');
    setShowCreateModal(false);
  };

  const getCategoryBadge = (cat: AnnouncementCategory) => {
    switch (cat) {
      case 'URGENT':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200"><AlertCircle size={12} /> Urgent</span>;
      case 'PROGRAMME':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"><Calendar size={12} /> Programme</span>;
      case 'LOGISTIQUE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200"><Truck size={12} /> Logistique</span>;
      case 'KEYNOTE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200"><Sparkles size={12} /> Keynote</span>;
      case 'HACKATHON':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200"><Trophy size={12} /> Hackathon</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">Général</span>;
    }
  };


  return (
    <div id="announcements-container" className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-white/20 rounded-lg backdrop-blur-xs">
              <Bell size={20} className="text-white" />
            </span>
            <span className="text-xs font-semibold tracking-wider uppercase text-amber-100">
              Centre de Communications Officielles
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Annonces & Notifications</h1>
          <p className="text-amber-100 text-sm mt-1 max-w-xl">
            Restez informé en temps réel des changements de salles, navettes, supports de cours, défis du hackathon et alertes urgentes.
          </p>
        </div>

        {canPublish && (
          <button
            id="btn-create-announcement"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-black text-white text-sm font-medium rounded-xl shadow-md transition-all active:scale-95 shrink-0"
          >
            <Plus size={16} />
            <span>Publier une annonce</span>
          </button>
        )}
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200/60">
          {categories.map(cat => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                <Icon size={14} className={cat.color || (isSelected ? 'text-amber-600' : 'text-stone-400')} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/*
        Les annonces viennent du classeur : quand il est illisible ou qu'aucune
        voie d'écriture n'est configurée, il faut le dire ici plutôt que de
        laisser croire à une liste complète.
      */}
      {socialWarning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-xs leading-relaxed">
          <Bell size={14} className="mt-0.5 shrink-0" />
          <span>{socialWarning}</span>
        </div>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-stone-200/80 p-8 shadow-xs">
            <Bell size={40} className="mx-auto text-stone-300 mb-3" />
            <h3 className="text-base font-semibold text-stone-800">Aucune annonce dans cette catégorie</h3>
            <p className="text-sm text-stone-500 mt-1">Sélectionnez une autre thématique pour voir les communications de l'IndabaX.</p>
          </div>
        ) : (
          filteredAnnouncements.map((ann) => {
            const isLiked = ann.likedBy.includes(currentUser.id);
            const isExpanded = !!expandedComments[ann.id];
            const isUrgent = ann.priority === 'urgent';

            return (
              <motion.div
                key={ann.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                  isUrgent
                    ? 'border-red-300 ring-2 ring-red-500/10'
                    : ann.pinned
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-stone-200/80 hover:border-stone-300'
                }`}
              >
                {/* Header Card */}
                <div className="p-5 md:p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={ann.authorName}
                        url={ann.authorAvatar}
                        size={40}
                        className="shadow-xs"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-stone-900 text-sm">{ann.authorName}</span>
                          <RoleBadge role={ann.authorRole} />
                        </div>
                        <span className="text-xs text-stone-400">
                          {new Date(ann.timestamp).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {ann.pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-200">
                          <Pin size={11} className="fill-amber-600 text-amber-600 rotate-45" /> Épinglé
                        </span>
                      )}
                      {getCategoryBadge(ann.category)}
                    </div>
                  </div>

                  {/* Title & Body */}
                  <h2 className={`text-lg font-bold mb-2 ${isUrgent ? 'text-red-950' : 'text-stone-900'}`}>
                    {ann.title}
                  </h2>
                  <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                    {ann.content}
                  </p>

                  {/* Footer Action Bar */}
                  <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <div className="flex items-center gap-4">
                      {/* Like button */}
                      <button
                        id={`btn-like-${ann.id}`}
                        onClick={() => likeAnnouncement(ann.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
                          isLiked
                            ? 'bg-rose-50 text-rose-600'
                            : 'hover:bg-stone-100 text-stone-600'
                        }`}
                      >
                        <Heart size={15} className={isLiked ? 'fill-rose-500 text-rose-500' : ''} />
                        <span>{ann.likes > 0 ? ann.likes : 'J\'aime'}</span>
                      </button>

                      {/* Comments toggle button */}
                      <button
                        id={`btn-toggle-comments-${ann.id}`}
                        onClick={() => toggleComments(ann.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors font-medium"
                      >
                        <MessageSquare size={15} />
                        <span>{ann.comments.length > 0 ? `${ann.comments.length} commentaire(s)` : 'Commenter'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {ann.targetAudience && ann.targetAudience !== 'all' && (
                        <span className="flex items-center gap-1 text-[11px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                          <Users size={12} /> Cible : {ann.targetAudience}
                        </span>
                      )}

                      {/*
                        Épingler et retirer : réservé aux rôles responsables du
                        contenu. Le retrait masque l'annonce sans effacer la
                        ligne du classeur, ce qui garde la trace de ce qui a
                        été dit pendant l'événement.
                      */}
                      {canModerate && (
                        <>
                          <button
                            onClick={() => togglePinAnnouncement(ann.id)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              ann.pinned
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'text-stone-500 hover:bg-stone-100'
                            }`}
                            title={ann.pinned ? 'Ne plus épingler' : 'Épingler en tête'}
                          >
                            {ann.pinned ? 'Épinglée' : 'Épingler'}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Retirer l'annonce « ${ann.title} » ? Elle disparaîtra de l'application ; sa ligne reste dans le classeur.`)) {
                                deleteAnnouncement(ann.id);
                              }
                            }}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold text-stone-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Retirer cette annonce"
                          >
                            Retirer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Collapsible Comments Section */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-stone-50/80 border-t border-stone-200/70 p-5 space-y-4"
                    >
                      {/* Comment Input */}
                      <div className="flex items-center gap-2">
                        <img
                          src={currentUser.avatarUrl}
                          alt={currentUser.name}
                          className="w-8 h-8 rounded-full object-cover border border-stone-200 shrink-0"
                        />
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Écrire un commentaire public..."
                            value={commentInputs[ann.id] || ''}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [ann.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSendComment(ann.id);
                              }
                            }}
                            className="w-full pl-3 pr-10 py-2 text-xs bg-white border border-stone-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-800"
                          />
                          <button
                            onClick={() => handleSendComment(ann.id)}
                            disabled={!commentInputs[ann.id]?.trim()}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-amber-600 hover:text-amber-700 disabled:text-stone-300 transition-colors"
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Comments Thread */}
                      {ann.comments.length > 0 ? (
                        <div className="space-y-2.5 pt-2">
                          {ann.comments.map((comm) => (
                            <div key={comm.id} className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-stone-200/60 shadow-2xs text-xs">
                              <Avatar
                                name={comm.authorName}
                                seed={comm.authorId}
                                url={comm.authorAvatar}
                                size={28}
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-stone-900">{comm.authorName}</span>
                                    <RoleBadge role={comm.authorRole} />
                                  </div>
                                  <span className="text-[10px] text-stone-400">
                                    {new Date(comm.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-stone-700 leading-snug">{comm.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 text-center py-2">Soyez le premier à commenter cette annonce.</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Create Announcement Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-stone-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-base">Nouvelle Annonce Officielle</h3>
                    <p className="text-xs text-stone-500">Publié sous l'identité de {currentUser.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Titre de l'annonce</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Changement de salle pour le Workshop PyTorch"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Catégorie</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as AnnouncementCategory)}
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="PROGRAMME">Programme & Sessions</option>
                      <option value="LOGISTIQUE">Logistique & Navettes</option>
                      <option value="URGENT">Alerte Urgente</option>
                      <option value="KEYNOTE">Keynotes & Invités</option>
                      <option value="HACKATHON">Hackathon & Défis</option>
                      <option value="SOCIAL">Soirée & Networking</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Priorité</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="normal">Normale</option>
                      <option value="high">Haute</option>
                      <option value="urgent">Urgente (Bannière Rouge)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Message détaillé</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Détaillez les informations, instructions, liens ou consignes pour les participants..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPinned}
                      onChange={(e) => setNewPinned(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="text-xs font-medium text-stone-700">Épingler en haut du fil</span>
                  </label>

                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <Users size={14} />
                    <select
                      value={newAudience}
                      onChange={(e) => setNewAudience(e.target.value as any)}
                      className="bg-transparent font-medium text-stone-700 text-xs focus:outline-hidden"
                    >
                      <option value="all">Tous les participants</option>
                      <option value="speakers">Conférenciers</option>
                      <option value="volunteers">Volontaires</option>
                      <option value="attendees">Auditeurs</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors"
                  >
                    Publier l'annonce
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
