import React, { useState } from 'react';
import {
  Building2,
  Briefcase,
  Globe,
  Linkedin,
  MapPin,
  Phone,
  Tag,
  User,
  X,
  Check,
  Loader2,
} from 'lucide-react';

import { useEvent } from '../context/EventContext';
import { Participant } from '../types';

/**
 * Formulaire d'édition de son propre profil.
 *
 * Ouvert à tout le monde, quel que soit le rôle : chacun est le mieux placé
 * pour dire où il travaille et comment le joindre. Ce qui reste hors de portée
 * est ce qui engage l'organisation — le rôle, le statut, le numéro de billet —
 * et cela relève du serveur, pas de cette interface.
 *
 * Le téléphone est présenté comme un numéro WhatsApp, parce que c'est ainsi
 * qu'il servira : au Bénin, c'est par là que les participants se rappellent.
 */

interface ProfileEditorProps {
  person: Participant;
  onClose: () => void;
}

interface Champ {
  cle: 'name' | 'institution' | 'position' | 'city' | 'country' | 'phone' | 'website' | 'linkedin';
  label: string;
  icon: React.ElementType;
  placeholder: string;
  /** Précision affichée sous le champ, quand elle évite une hésitation. */
  aide?: string;
  type?: string;
}

const CHAMPS: Champ[] = [
  { cle: 'name', label: 'Nom complet', icon: User, placeholder: 'Prénom Nom' },
  {
    cle: 'institution',
    label: 'Institution',
    icon: Building2,
    placeholder: 'Université, entreprise, laboratoire…',
  },
  { cle: 'position', label: 'Poste', icon: Briefcase, placeholder: 'Doctorante, ingénieur, étudiant…' },
  { cle: 'city', label: 'Ville', icon: MapPin, placeholder: 'Cotonou' },
  { cle: 'country', label: 'Pays', icon: MapPin, placeholder: 'Bénin' },
  {
    cle: 'phone',
    label: 'Téléphone (WhatsApp)',
    icon: Phone,
    placeholder: '+229 97 00 00 00',
    aide: 'Visible par les autres participants, pour vous joindre pendant l’événement.',
    type: 'tel',
  },
  {
    cle: 'website',
    label: 'Site web',
    icon: Globe,
    placeholder: 'mon-site.bj',
    aide: 'Site personnel, portfolio, ou page de votre organisation.',
  },
  { cle: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'linkedin.com/in/…' },
];

export const ProfileEditor: React.FC<ProfileEditorProps> = ({ person, onClose }) => {
  const { saveMyProfile } = useEvent();

  const [valeurs, setValeurs] = useState<Record<string, string>>({
    name: person.name || '',
    institution: person.institution === 'Non renseigné' ? '' : person.institution || '',
    position: person.position === 'Participant' ? '' : person.position || '',
    city: person.city || '',
    country: person.country || '',
    phone: person.phone || '',
    website: person.website || '',
    linkedin: person.linkedin || '',
  });

  const [bio, setBio] = useState(person.bio || '');
  const [interets, setInterets] = useState((person.interests || []).join(', '));

  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const champClass =
    'w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white ' +
    'dark:bg-stone-950 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 ' +
    'focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';

  const nomVide = valeurs.name.trim() === '';

  const enregistrer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (nomVide || enCours) return;

    setEnCours(true);
    setErreur(null);
    setMessage(null);

    try {
      const retour = await saveMyProfile({
        name: valeurs.name,
        institution: valeurs.institution,
        position: valeurs.position,
        city: valeurs.city,
        country: valeurs.country,
        phone: valeurs.phone,
        website: valeurs.website,
        linkedin: valeurs.linkedin,
        bio,
        interests: interets
          .split(/[;,\n]/)
          .map(item => item.trim())
          .filter(Boolean),
      });

      setMessage(retour);
      // Laisse le temps de lire le retour, notamment un avertissement.
      setTimeout(onClose, retour.length > 60 ? 2600 : 1100);
    } catch (e: any) {
      setErreur(e?.message || "L'enregistrement a échoué.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form
      onSubmit={enregistrer}
      className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 shadow-2xs space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">Modifier mes informations</h2>
          <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
            Ce que vous renseignez ici part dans le classeur de l&apos;événement et s&apos;affiche sur
            votre fiche. Votre rôle et votre statut ne se changent pas d&apos;ici : ils appartiennent
            aux organisateurs.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 -m-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg transition cursor-pointer shrink-0"
          title="Fermer sans enregistrer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CHAMPS.map(({ cle, label, icon: Icon, placeholder, aide, type }) => (
          <div key={cle} className={cle === 'name' ? 'md:col-span-2' : ''}>
            <label
              htmlFor={`profil-${cle}`}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1"
            >
              <Icon size={12} />
              {label}
              {cle === 'name' && <span className="text-rose-500 normal-case">obligatoire</span>}
            </label>
            <input
              id={`profil-${cle}`}
              type={type || 'text'}
              value={valeurs[cle]}
              onChange={event => setValeurs(prev => ({ ...prev, [cle]: event.target.value }))}
              placeholder={placeholder}
              className={champClass}
            />
            {aide && <p className="text-[10px] text-stone-400 mt-1 leading-snug">{aide}</p>}
          </div>
        ))}
      </div>

      <div>
        <label
          htmlFor="profil-interets"
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1"
        >
          <Tag size={12} />
          Centres d&apos;intérêt
        </label>
        <input
          id="profil-interets"
          value={interets}
          onChange={event => setInterets(event.target.value)}
          placeholder="NLP, Vision par ordinateur, MLOps"
          className={champClass}
        />
        <p className="text-[10px] text-stone-400 mt-1">
          Séparés par des virgules. Ils servent aux suggestions de rencontres.
        </p>
      </div>

      <div>
        <label
          htmlFor="profil-bio"
          className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1"
        >
          Présentation
        </label>
        <textarea
          id="profil-bio"
          value={bio}
          onChange={event => setBio(event.target.value)}
          rows={4}
          maxLength={1200}
          placeholder="Sur quoi travaillez-vous ? Que cherchez-vous à l'événement ?"
          className={`${champClass} resize-y`}
        />
        <p className="text-[10px] text-stone-400 mt-1">{bio.length} / 1200 caractères</p>
      </div>

      {erreur && (
        <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2">
          {erreur}
        </p>
      )}

      {message && (
        <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl px-3 py-2">
          {message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={enCours || nomVide}
          className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
        >
          {enCours ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 px-3 py-2.5 rounded-xl transition cursor-pointer"
        >
          Annuler
        </button>
      </div>
    </form>
  );
};
