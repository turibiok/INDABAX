import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  Smile, 
  Paperclip, 
  Search, 
  Hash, 
  Users, 
  Sparkles, 
  Languages, 
  Camera, 
  Briefcase, 
  Trophy, 
  Car, 
  UserCheck, 
  ChevronRight, 
  ExternalLink,
  AtSign,
  Shield,
  HelpCircle
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { ChatMessage, Participant } from '../types';

export const DiscussionsView: React.FC = () => {
  const { 
    currentUser, 
    channels, 
    chatMessages, 
    participants, 
    activeChannelId, 
    setActiveChannelId, 
    activeDirectPartnerId, 
    setActiveDirectPartnerId, 
    sendChannelMessage, 
    sendDirectMessage, 
    reactToMessage 
  } = useEvent();

  const [messageText, setMessageText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [isDirectMode, setIsDirectMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeChannelId, activeDirectPartnerId]);

  // If activeDirectPartnerId changes, switch to Direct mode
  useEffect(() => {
    if (activeDirectPartnerId) {
      setIsDirectMode(true);
    }
  }, [activeDirectPartnerId]);

  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];
  const activePartner = participants.find(p => p.id === activeDirectPartnerId);

  // Current active conversation ID for Direct Message
  const currentDmId = (activePartner && currentUser) 
    ? `dm_${[currentUser.id, activePartner.id].sort().join('_')}` 
    : '';

  // Filter messages based on active mode
  const currentMessages = chatMessages.filter(msg => {
    if (isDirectMode && activePartner) {
      return msg.channelId === currentDmId || msg.conversationId === currentDmId;
    } else {
      return msg.channelId === activeChannelId;
    }
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() && !attachmentUrl.trim()) return;

    if (isDirectMode && activePartner) {
      sendDirectMessage(activePartner.id, messageText.trim());
    } else {
      sendChannelMessage(
        activeChannelId, 
        messageText.trim(), 
        attachmentUrl.trim() ? attachmentUrl.trim() : undefined,
        attachmentUrl.trim() ? 'link' : undefined
      );
    }

    setMessageText('');
    setAttachmentUrl('');
    setShowAttachmentInput(false);
  };

  const generateIcebreaker = () => {
    if (!activePartner) return;
    const sharedInterests = (currentUser.interests || []).filter(i => (activePartner.interests || []).includes(i));
    if (sharedInterests.length > 0) {
      setMessageText(`Bonjour ${activePartner.name}, ravi(e) de te rencontrer à IndabaX Bénin ! J'ai vu que nous nous intéressons tous les deux à ${sharedInterests.join(' et ')}. Tu participes à quel workshop aujourd'hui ?`);
    } else {
      setMessageText(`Bonjour ${activePartner.name} ! Je suis ${currentUser.name} (${currentUser.institution}). Au plaisir d'échanger sur vos projets en IA et d'assister aux sessions ensemble !`);
    }
  };

  const getChannelIcon = (iconName: string) => {
    switch (iconName) {
      case 'Languages': return <Languages size={16} />;
      case 'Camera': return <Camera size={16} />;
      case 'Briefcase': return <Briefcase size={16} />;
      case 'Trophy': return <Trophy size={16} />;
      case 'Car': return <Car size={16} />;
      default: return <Hash size={16} />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'organizer':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500 text-white">Org</span>;
      case 'speaker':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-600 text-white">Speaker</span>;
      case 'volunteer':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-600 text-white">Volontaire</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-stone-200 text-stone-700">Membre</span>;
    }
  };

  const filteredMembers = participants.filter(p => 
    p.id !== currentUser.id && (
      p.name.toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
      p.institution.toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
      p.role.toLowerCase().includes(searchMemberQuery.toLowerCase())
    )
  );

  return (
    <div id="discussions-container" className="max-w-6xl mx-auto px-4 py-4 h-[calc(100vh-130px)] min-h-[580px] flex flex-col">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-3.5 mb-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-900 leading-tight">Discussions & Salons Thématiques</h1>
            <p className="text-xs text-stone-500">Échangez en direct avec conférenciers, volontaires, organisateurs et participants de l'IndabaX.</p>
          </div>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
          <button
            onClick={() => { setIsDirectMode(false); setActiveDirectPartnerId(null); }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              !isDirectMode ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <Hash size={13} />
            <span>Salons Publics</span>
          </button>
          <button
            onClick={() => { 
              setIsDirectMode(true); 
              if (!activeDirectPartnerId && participants.length > 1) {
                const partner = participants.find(p => p.id !== currentUser.id);
                if (partner) setActiveDirectPartnerId(partner.id);
              }
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              isDirectMode ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <Users size={13} />
            <span>Messages Privés</span>
          </button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden flex flex-col md:flex-row">
        {/* Left Sidebar */}
        <div className="w-full md:w-72 bg-stone-50/70 border-r border-stone-200/70 flex flex-col shrink-0">
          {!isDirectMode ? (
            /* Channels List */
            <div className="p-3 space-y-1 overflow-y-auto flex-1">
              <div className="px-2 py-1.5 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Canaux Thématiques ({channels.length})
              </div>
              {channels.map((chan) => {
                const isActive = activeChannelId === chan.id;
                return (
                  <button
                    key={chan.id}
                    onClick={() => {
                      setActiveChannelId(chan.id);
                      setIsDirectMode(false);
                      setActiveDirectPartnerId(null);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all ${
                      isActive 
                        ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                        : 'text-stone-700 hover:bg-stone-200/60 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className={isActive ? 'text-white' : 'text-stone-500'}>
                        {getChannelIcon(chan.iconName)}
                      </span>
                      <span className="truncate">{chan.name}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-600'
                    }`}>
                      {chan.memberCount}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Direct Messages / Members List */
            <div className="flex flex-col h-full">
              <div className="p-3 border-b border-stone-200/70">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un membre..."
                    value={searchMemberQuery}
                    onChange={(e) => setSearchMemberQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="p-2 space-y-1 overflow-y-auto flex-1">
                {filteredMembers.map((member) => {
                  const isSelected = activeDirectPartnerId === member.id;
                  return (
                    <button
                      key={member.id}
                      onClick={() => {
                        setActiveDirectPartnerId(member.id);
                        setIsDirectMode(true);
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-xs transition-all ${
                        isSelected 
                          ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                          : 'text-stone-700 hover:bg-stone-200/60'
                      }`}
                    >
                      <div className="relative">
                        <img 
                          src={member.avatarUrl} 
                          alt={member.name} 
                          className="w-8 h-8 rounded-full object-cover border border-stone-200 shrink-0" 
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                      </div>
                      <div className="flex-1 truncate">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-semibold">{member.name}</span>
                          {getRoleBadge(member.role)}
                        </div>
                        <span className={`text-[10px] truncate block ${isSelected ? 'text-amber-100' : 'text-stone-400'}`}>
                          {member.position} • {member.institution}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current User Pill */}
          <div className="p-3 border-t border-stone-200/70 bg-stone-100/60 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <img 
                src={currentUser.avatarUrl} 
                alt={currentUser.name} 
                className="w-7 h-7 rounded-full object-cover border border-stone-300" 
              />
              <div className="truncate text-xs">
                <p className="font-semibold text-stone-900 truncate leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-stone-500 truncate">{currentUser.email}</p>
              </div>
            </div>
            {getRoleBadge(currentUser.role)}
          </div>
        </div>

        {/* Main Conversation Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-stone-50/20">
          {/* Conversation Header */}
          <div className="p-3.5 border-b border-stone-200/80 bg-white flex items-center justify-between shrink-0">
            {!isDirectMode ? (
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                  {getChannelIcon(activeChannel.iconName)}
                </div>
                <div>
                  <h2 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                    <span>#{activeChannel.slug}</span>
                    <span className="text-xs font-normal text-stone-400">({activeChannel.name})</span>
                  </h2>
                  <p className="text-xs text-stone-500 truncate max-w-md">{activeChannel.description}</p>
                </div>
              </div>
            ) : activePartner ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2.5">
                  <img 
                    src={activePartner.avatarUrl} 
                    alt={activePartner.name} 
                    className="w-9 h-9 rounded-full object-cover border border-stone-200" 
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-stone-900 text-sm">{activePartner.name}</h2>
                      {getRoleBadge(activePartner.role)}
                    </div>
                    <p className="text-xs text-stone-500 truncate">
                      {activePartner.position} • {activePartner.institution} ({activePartner.city})
                    </p>
                  </div>
                </div>

                <button
                  onClick={generateIcebreaker}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200 transition-colors"
                >
                  <Sparkles size={13} className="text-amber-600" />
                  <span>Générer amorce IA</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {currentMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
                <MessageSquare size={36} className="text-stone-300 mb-2" />
                <p className="text-sm font-semibold text-stone-700">Aucun message pour le moment</p>
                <p className="text-xs text-stone-500 max-w-xs mt-1">
                  Lancez la discussion ! Présentez-vous ou partagez vos impressions sur la conférence.
                </p>
                {isDirectMode && activePartner && (
                  <button
                    onClick={generateIcebreaker}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-xs hover:bg-amber-600 transition-colors"
                  >
                    <Sparkles size={13} />
                    <span>Créer une phrase d'accroche</span>
                  </button>
                )}
              </div>
            ) : (
              currentMessages.map((msg) => {
                const isMe = msg.senderId === currentUser.id;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <img 
                      src={msg.senderAvatar} 
                      alt={msg.senderName} 
                      className="w-8 h-8 rounded-full object-cover border border-stone-200 shrink-0 mt-0.5" 
                    />

                    <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-semibold text-stone-800">{msg.senderName}</span>
                        {getRoleBadge(msg.senderRole)}
                        <span className="text-[10px] text-stone-400">
                          {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                        isMe 
                          ? 'bg-amber-600 text-white rounded-tr-xs' 
                          : 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs'
                      }`}>
                        <p className="whitespace-pre-line">{msg.content}</p>

                        {/* Link or Attachment */}
                        {msg.attachmentUrl && (
                          <div className={`mt-2 pt-2 border-t flex items-center gap-1.5 ${
                            isMe ? 'border-amber-500/60 text-amber-100' : 'border-stone-100 text-amber-700'
                          }`}>
                            <ExternalLink size={13} />
                            <a 
                              href={msg.attachmentUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="font-medium underline truncate hover:opacity-80"
                            >
                              {msg.attachmentUrl}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Reactions Bar */}
                      <div className="flex items-center gap-1 mt-1 px-1">
                        {msg.reactions && Object.entries(msg.reactions).map(([emoji, users]) => {
                          const userList = Array.isArray(users) ? (users as string[]) : [];
                          const hasReacted = userList.includes(currentUser.id);
                          return (
                            <button
                              key={emoji}
                              onClick={() => reactToMessage(msg.id, emoji)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-colors border ${
                                hasReacted 
                                  ? 'bg-amber-100 border-amber-300 text-amber-800 font-bold' 
                                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{userList.length}</span>
                            </button>
                          );
                        })}

                        {/* Fast Reaction Trigger */}
                        <div className="flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
                          {['👍', '❤️', '🔥', '💡'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => reactToMessage(msg.id, emoji)}
                              className="hover:scale-125 transition-transform text-[11px] p-0.5"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box */}
          <div className="p-3 border-t border-stone-200/80 bg-white shrink-0">
            {showAttachmentInput && (
              <div className="mb-2 p-2 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-2">
                <Paperclip size={14} className="text-stone-400" />
                <input
                  type="url"
                  placeholder="Coller un lien (GitHub, Colab, Google Drive, Slide PDF)..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="flex-1 text-xs bg-transparent focus:outline-hidden"
                />
                <button 
                  onClick={() => setShowAttachmentInput(false)}
                  className="text-stone-400 hover:text-stone-600 text-xs px-1"
                >
                  Fermer
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAttachmentInput(!showAttachmentInput)}
                className={`p-2 rounded-xl transition-colors ${
                  showAttachmentInput ? 'bg-amber-100 text-amber-700' : 'text-stone-400 hover:bg-stone-100'
                }`}
                title="Joindre un lien de ressource"
              >
                <Paperclip size={16} />
              </button>

              <input
                type="text"
                placeholder={
                  isDirectMode && activePartner 
                    ? `Message privé à ${activePartner.name}...` 
                    : `Message dans #${activeChannel.slug}...`
                }
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white text-stone-800"
              />

              <button
                type="submit"
                disabled={!messageText.trim() && !attachmentUrl.trim()}
                className="p-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
