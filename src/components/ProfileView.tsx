import React, { useMemo, useRef, useState } from 'react';
import {
  Building2,
  Briefcase,
  MapPin,
  Phone,
  Linkedin,
  Ticket,
  Mail,
  QrCode,
  ScanLine,
  Star,
  Bell,
  MessageSquare,
  CalendarCheck,
  Users,
  LogOut,
  Lock,
  ArrowLeft,
  ShieldCheck,
  Camera,
} from 'lucide-react';

import { useEvent } from '../context/EventContext';
import { Participant } from '../types';
import { capabilitiesFor } from '../permissions';
import { prepareProfilePhoto } from '../lib/image';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

/**
 * Fiche d'une personne : ses informations et tout ce qu'elle a fait.
 *
 * L'application montrait jusqu'ici des listes par nature — les émargements
 * d'un côté, les avis d'un autre, les annonces ailleurs — sans jamais réunir
 * ce qu'une personne donnée avait fait. C'est pourtant la question la plus
 * courante d'un organisateur pendant l'événement : « qu'a fait celle-ci ? »
 *
 * Deux usages, une seule vue : sa propre fiche, ou celle d'une autre personne
 * choisie dans le réseautage.
 */

/** Une activité, quelle que soit sa nature, ramenée à une même forme. */
interface Activity {
  id: string;
  kind: 'checkin' | 'feedback' | 'announcement' | 'message' | 'comment' | 'connection';
  label: string;
  detail: string;
  timestamp: string;
}

const KIND_STYLE: Record<Activity['kind'], { icon: React.ElementType; tint: string; name: string }> = {
  checkin: { icon: ScanLine, tint: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', name: 'Émargement' },
  feedback: { icon: Star, tint: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40', name: 'Avis' },
  announcement: { icon: Bell, tint: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40', name: 'Annonce' },
  message: { icon: MessageSquare, tint: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40', name: 'Message' },
  comment: { icon: MessageSquare, tint: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40', name: 'Commentaire' },
  connection: { icon: Users, tint: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40', name: 'Rencontre' },
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ProfileView: React.FC = () => {
  const {
    currentUser,
    participants,
    capabilities,
    checkIns,
    feedbacks,
    announcements,
    chatMessages,
    channels,
    connections,
    savedSessionIds,
    sessions,
    userAccounts,
    setActiveTab,
    setActiveDirectPartnerId,
    changeMyPhoto,
    signOut,
  } = useEvent();

  /** Personne affichée. Vide = soi-même. */
  const [viewedId, setViewedId] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ text: string; ok: boolean } | null>(null);

  /** Envoie une valeur déjà prête : image réduite, adresse, ou chaîne vide. */
  const applyPhoto = async (value: string) => {
    setPhotoBusy(true);
    setPhotoMessage(null);

    try {
      setPhotoMessage({ text: await changeMyPhoto(value), ok: true });
    } catch (error: any) {
      setPhotoMessage({ text: error?.message || "La photo n'a pas pu être enregistrée.", ok: false });
    } finally {
      setPhotoBusy(false);
    }
  };

  const handlePhotoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Le champ est vidé tout de suite : sans cela, choisir deux fois le même
    // fichier ne déclencherait rien la seconde fois.
    event.target.value = '';
    if (!file) return;

    setPhotoBusy(true);
    setPhotoMessage(null);

    try {
      const prepared = await prepareProfilePhoto(file);
      setPhotoMessage({ text: await changeMyPhoto(prepared), ok: true });
    } catch (error: any) {
      setPhotoMessage({ text: error?.message || "Cette image n'a pas pu être préparée.", ok: false });
    } finally {
      setPhotoBusy(false);
    }
  };

  const person: Participant = useMemo(
    () => participants.find(p => p.id === viewedId) || currentUser,
    [participants, viewedId, currentUser],
  );
  const isSelf = person.id === currentUser.id;

  const email = (person.email || '').toLowerCase();

  /**
   * Le compte correspondant, quand la liste est accessible.
   *
   * Seuls les rôles qui gèrent les comptes la reçoivent du serveur : pour les
   * autres, `userAccounts` est vide et le bloc n'apparaît pas, ce qui est la
   * bonne réponse plutôt qu'une case vide.
   */
  const account = useMemo(
    () => userAccounts.find(a => a.email.toLowerCase() === email),
    [userAccounts, email],
  );

  const activities = useMemo<Activity[]>(() => {
    const items: Activity[] = [];

    for (const record of checkIns) {
      if ((record.participantEmail || '').toLowerCase() !== email) continue;
      items.push({
        id: `checkin-${record.id}`,
        kind: 'checkin',
        label: record.sessionTitle,
        detail: `${record.room || 'Salle non précisée'} • scanné par ${record.scannedBy || 'un organisateur'}`,
        timestamp: record.timestamp,
      });
    }

    // Les avis ne portent pas d'email : ils sont rattachés au nom, tel que
    // l'application l'inscrit au moment de l'envoi.
    for (const feedback of feedbacks) {
      if (feedback.participantId !== person.id && feedback.participantName !== person.name) continue;
      items.push({
        id: `feedback-${feedback.id}`,
        kind: 'feedback',
        label: feedback.sessionTitle,
        detail:
          `${feedback.overallRating}/5 — ${feedback.comments || 'sans commentaire'}` +
          (feedback.questionForSpeaker ? ` • question posée` : ''),
        timestamp: feedback.timestamp,
      });
    }

    for (const announcement of announcements) {
      if (announcement.authorName !== person.name) continue;
      items.push({
        id: `ann-${announcement.id}`,
        kind: 'announcement',
        label: announcement.title,
        detail: announcement.content.slice(0, 140),
        timestamp: announcement.timestamp,
      });

      for (const comment of announcement.comments) {
        if ((comment.authorId || '').toLowerCase() !== email) continue;
        items.push({
          id: `comment-${comment.id}`,
          kind: 'comment',
          label: `Sous « ${announcement.title} »`,
          detail: comment.content,
          timestamp: comment.timestamp,
        });
      }
    }

    // Les commentaires sous les annonces d'autrui, que la boucle ci-dessus
    // n'atteint pas puisqu'elle ne parcourt que les annonces de la personne.
    for (const announcement of announcements) {
      if (announcement.authorName === person.name) continue;
      for (const comment of announcement.comments) {
        if ((comment.authorId || '').toLowerCase() !== email) continue;
        items.push({
          id: `comment-${comment.id}`,
          kind: 'comment',
          label: `Sous « ${announcement.title} »`,
          detail: comment.content,
          timestamp: comment.timestamp,
        });
      }
    }

    for (const message of chatMessages) {
      if ((message.senderId || '').toLowerCase() !== email) continue;
      if (!message.channelId) continue;

      const channel = channels.find(c => c.id === message.channelId);
      items.push({
        id: `msg-${message.id}`,
        kind: 'message',
        label: channel ? `#${channel.slug}` : message.channelId,
        detail: message.content,
        timestamp: message.timestamp,
      });
    }

    // Les rencontres n'existent que pour soi : elles sont enregistrées par la
    // personne qui scanne, sur son propre appareil.
    if (isSelf) {
      for (const connection of connections) {
        items.push({
          id: `conn-${connection.id}`,
          kind: 'connection',
          label: connection.partnerName,
          detail: [connection.partnerInstitution, connection.metAtSession].filter(Boolean).join(' • '),
          timestamp: connection.timestamp,
        });
      }
    }

    return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [checkIns, feedbacks, announcements, chatMessages, channels, connections, email, person, isSelf]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const item of activities) tally[item.kind] = (tally[item.kind] || 0) + 1;
    return tally;
  }, [activities]);

  const savedSessions = useMemo(
    () => (isSelf ? sessions.filter(s => savedSessionIds.includes(s.id)) : []),
    [isSelf, sessions, savedSessionIds],
  );

  /** Personnes que l'on peut consulter : réservé aux rôles qui gèrent le contenu. */
  const browsable = useMemo(
    () => (capabilities.canManageContent ? participants.filter(p => p.id !== currentUser.id) : []),
    [capabilities.canManageContent, participants, currentUser.id],
  );

  const info: { icon: React.ElementType; label: string; value?: string }[] = [
    { icon: Mail, label: 'Email', value: person.email },
    { icon: Building2, label: 'Institution', value: person.institution },
    { icon: Briefcase, label: 'Poste', value: person.position },
    {
      icon: MapPin,
      label: 'Lieu',
      value: [person.city, person.country].filter(Boolean).join(', '),
    },
    { icon: Phone, label: 'Téléphone', value: person.phone },
    { icon: Linkedin, label: 'LinkedIn', value: person.linkedin },
    { icon: Ticket, label: 'Billet', value: person.ticketNumber },
  ];

  return (
    <div id="profile-container" className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Bandeau d'identité */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-2xl p-6 text-white shadow-sm">
        {!isSelf && (
          <button
            onClick={() => setViewedId(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-100 hover:text-white mb-3 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Revenir à ma fiche
          </button>
        )}

        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <Avatar name={person.name} seed={person.email} url={person.avatarUrl} size={64} />

            {/* Chacun change sa photo, personne ne change celle d'un autre. */}
            {isSelf && (
              <div className="mt-2 flex flex-col gap-1">
                <button
                  id="btn-change-photo"
                  onClick={() => fileInput.current?.click()}
                  disabled={photoBusy}
                  className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 hover:text-white disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  <Camera size={12} />
                  {photoBusy ? 'Envoi…' : 'Photo'}
                </button>

                {person.avatarUrl && (
                  <button
                    onClick={() => applyPhoto('')}
                    disabled={photoBusy}
                    className="text-[10px] font-semibold text-emerald-200/80 hover:text-white disabled:opacity-50 cursor-pointer"
                  >
                    Retirer
                  </button>
                )}

                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoFile}
                />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{person.name}</h1>
              <RoleBadge role={person.role} />
            </div>

            {person.bio ? (
              <p className="text-emerald-50 text-sm mt-2 leading-relaxed">{person.bio}</p>
            ) : (
              <p className="text-emerald-200/70 text-sm mt-2 italic">
                Aucune présentation renseignée dans le classeur.
              </p>
            )}

            {photoMessage && (
              <p
                className={`text-xs mt-2 rounded-lg px-2.5 py-1.5 ${
                  photoMessage.ok ? 'bg-white/15 text-emerald-50' : 'bg-red-900/40 text-red-100'
                }`}
              >
                {photoMessage.text}
              </p>
            )}

            {person.interests && person.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {person.interests.map(interest => (
                  <span
                    key={interest}
                    className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-medium backdrop-blur-xs"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compteurs d'activité */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/*
          Le quatrième compteur suit le rôle de la personne : pour qui diffuse,
          le nombre d'annonces publiées est le chiffre utile ; pour les autres,
          c'est le nombre de commentaires laissés.
        */}
        {(
          [
            'checkin',
            'feedback',
            'message',
            capabilitiesFor(person.role).canBroadcast ? 'announcement' : 'comment',
          ] as Activity['kind'][]
        ).map(kind => {
          const style = KIND_STYLE[kind];
          const Icon = style.icon;
          return (
            <div
              key={kind}
              className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-4 shadow-2xs"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${style.tint}`}>
                <Icon size={16} />
              </div>
              <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                {counts[kind] || 0}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                {style.name}
                {(counts[kind] || 0) > 1 ? 's' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Informations */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 shadow-2xs">
        <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-3">Informations</h2>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {info.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2.5 min-w-0">
              <Icon size={15} className="text-stone-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</dt>
                <dd className="text-sm text-stone-800 dark:text-stone-200 break-words">
                  {value || <span className="text-stone-400 italic">non renseigné</span>}
                </dd>
              </div>
            </div>
          ))}
        </dl>

        {account && (
          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2 text-[11px]">
            <ShieldCheck size={14} className="text-stone-400" />
            <span className="font-semibold text-stone-600 dark:text-stone-300">Compte :</span>
            <span
              className={`px-2 py-0.5 rounded font-bold uppercase ${
                account.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : account.status === 'pending'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              {account.status === 'active' ? 'Actif' : account.status === 'pending' ? 'En attente' : 'Suspendu'}
            </span>
            <span
              className={`px-2 py-0.5 rounded font-bold uppercase ${
                account.hasPassword
                  ? 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                  : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {account.hasPassword ? 'Mot de passe choisi' : 'À activer'}
            </span>
            {account.assignedBy && (
              <span className="text-stone-400">Rôle attribué par {account.assignedBy}</span>
            )}
          </div>
        )}
      </div>

      {/* Sessions retenues, pour soi seulement */}
      {isSelf && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck size={16} className="text-emerald-600" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Mon programme ({savedSessions.length})
            </h2>
          </div>

          {savedSessions.length === 0 ? (
            <p className="text-xs text-stone-500">
              Aucune session retenue. Ajoutez-les depuis le programme pour les retrouver ici.
            </p>
          ) : (
            <ul className="space-y-2">
              {savedSessions.map(session => (
                <li
                  key={session.id}
                  className="flex items-start justify-between gap-3 text-xs border-b border-stone-100 dark:border-stone-800 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                      {session.title}
                    </p>
                    <p className="text-stone-400">
                      Jour {session.day} • {session.startTime} • {session.room}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Journal des activités */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 shadow-2xs">
        <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">
          Activités ({activities.length})
        </h2>
        <p className="text-[11px] text-stone-400 mb-4">
          Émargements, avis, annonces, messages et rencontres, de la plus récente à la plus ancienne.
        </p>

        {activities.length === 0 ? (
          <p className="text-xs text-stone-500">
            Aucune activité enregistrée pour le moment.
          </p>
        ) : (
          <ol className="space-y-3">
            {activities.map(item => {
              const style = KIND_STYLE[item.kind];
              const Icon = style.icon;

              return (
                <li key={item.id} className="flex items-start gap-3">
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${style.tint}`}
                  >
                    <Icon size={15} />
                  </span>

                  <div className="min-w-0 flex-1 border-b border-stone-100 dark:border-stone-800 pb-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 break-words">
                        {item.label}
                      </p>
                      <span className="text-[10px] text-stone-400 shrink-0">
                        {formatDateTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 break-words">
                      <span className="font-semibold text-stone-400 uppercase text-[10px] tracking-wider mr-1.5">
                        {style.name}
                      </span>
                      {item.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Consulter une autre fiche */}
      {browsable.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 shadow-2xs">
          <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-3">
            Consulter une autre fiche
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {browsable.map(other => (
              <button
                key={other.id}
                onClick={() => setViewedId(other.id)}
                className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition cursor-pointer"
              >
                <Avatar name={other.name} seed={other.email} url={other.avatarUrl} size={32} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                    {other.name}
                  </p>
                  <p className="text-[10px] text-stone-400 truncate">{other.institution}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions sur son propre compte */}
      {isSelf && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 shadow-2xs space-y-2">
          <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">Mon compte</h2>

          <button
            onClick={() => setActiveTab('badge')}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 text-left text-sm text-stone-700 dark:text-stone-200 transition cursor-pointer"
          >
            <QrCode size={16} className="text-emerald-600" />
            Mon badge et son QR code
          </button>

          {capabilities.tabs.includes('networking') && (
            <button
              onClick={() => {
                setActiveDirectPartnerId(null);
                setActiveTab('networking');
              }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 text-left text-sm text-stone-700 dark:text-stone-200 transition cursor-pointer"
            >
              <Users size={16} className="text-emerald-600" />
              Réseautage et rencontres
            </button>
          )}

          <p className="flex items-start gap-2.5 p-2.5 text-[11px] text-stone-500 leading-relaxed">
            <Lock size={14} className="text-stone-400 mt-0.5 shrink-0" />
            Votre mot de passe se change depuis le menu de votre compte, en haut à droite. Personne
            d&apos;autre ne le connaît : le serveur n&apos;en garde qu&apos;une empreinte.
          </p>

          <button
            id="btn-profile-signout"
            onClick={signOut}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 text-left text-sm font-semibold text-red-700 dark:text-red-300 transition cursor-pointer"
          >
            <LogOut size={16} />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
};
