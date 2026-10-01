import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';

import { changerMonMotDePasse, ComptePlateforme } from '../../services/plateforme';

/**
 * L'espace personnel d'un compte de plateforme.
 *
 * Il ne montre que ce qui regarde la personne : son identite, son etat, et de
 * quoi changer son mot de passe. Ce qu'elle organise est ailleurs, et ce que
 * les autres font ne la concerne pas.
 */

interface MonCompteProps {
  compte: ComptePlateforme;
  onRetour: () => void;
  /** Appele une fois le mot de passe change, pour relire l'etat du compte. */
  onChange: () => void;
  /**
   * Le mot de passe est provisoire et doit etre remplace.
   *
   * Dans ce cas l'ecran se presente seul, sans retour possible : laisser
   * circuler un mot de passe qu'un administrateur a lu a voix haute serait
   * precisement ce qu'on cherche a eviter.
   */
  impose?: boolean;
}

const MIN = 8;

export const MonCompte: React.FC<MonCompteProps> = ({ compte, onRetour, onChange, impose }) => {
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const provisoire = impose || compte.mustChangePassword;

  const tropCourt = nouveau.length > 0 && nouveau.length < MIN;
  const different = confirmation.length > 0 && nouveau !== confirmation;

  const pret =
    nouveau.length >= MIN &&
    nouveau === confirmation &&
    // L'ancien n'est pas demande quand il est provisoire : la personne vient de
    // le recevoir, et le redemander reviendrait a lui faire retaper ce qu'on
    // vient de lui dicter.
    (provisoire || ancien.length > 0) &&
    !envoi;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    setSucces(null);

    try {
      const r = await changerMonMotDePasse(ancien, nouveau);
      setSucces(r.message);
      setAncien('');
      setNouveau('');
      setConfirmation('');
      onChange();
    } catch (e: any) {
      setErreur(e?.message || "Le changement n'a pas abouti.");
    } finally {
      setEnvoi(false);
    }
  };

  const champ =
    'w-full px-3 py-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition';
  const etiquette =
    'text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5';

  const ETAT_ROLE: Record<ComptePlateforme['role'], string> = {
    admin: 'Administrateur de la plateforme',
    organizer: 'Organisateur',
    member: 'Membre',
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-xl mx-auto px-4 py-8">
        {!provisoire && (
          <button
            onClick={onRetour}
            className="text-sm font-bold text-stone-600 dark:text-stone-400 hover:text-emerald-700 cursor-pointer flex items-center gap-1.5 mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        )}

        <h1 className="font-heading font-black text-2xl tracking-tight">Mon compte</h1>

        <div className="mt-4 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 space-y-1">
          <p className="font-bold">{compte.name}</p>
          <p className="text-sm text-stone-600 dark:text-stone-400">{compte.email}</p>
          <p className="text-xs text-stone-500">{ETAT_ROLE[compte.role]}</p>

          {/*
            * L'etat de validation est dit ici, et pas seulement a l'echec d'une
            * publication : quelqu'un qui prepare son evenement doit savoir d'avance
            * qu'il ne pourra pas le publier, plutot que de le decouvrir au dernier
            * moment.
            */}
          {compte.role !== 'member' && (
            <p
              className={`text-xs font-bold ${
                compte.validated
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {compte.validated
                ? 'Compte validé — vos événements peuvent être publiés.'
                : 'En attente de validation — vous pouvez préparer un événement, pas le publier.'}
            </p>
          )}
        </div>

        {provisoire && (
          <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Votre mot de passe est provisoire : quelqu’un d’autre le connaît. Choisissez-en un
              autre maintenant.
            </p>
          </div>
        )}

        <h2 className="font-heading font-black text-lg mt-8 mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Mot de passe
        </h2>

        <form onSubmit={envoyer} className="space-y-4">
          {!provisoire && (
            <div>
              <label className={etiquette}>Mot de passe actuel</label>
              <input
                type="password"
                value={ancien}
                onChange={e => setAncien(e.target.value)}
                className={champ}
                autoComplete="current-password"
              />
              <p className="text-xs text-stone-500 mt-1.5">
                Demandé même avec une session ouverte : un poste laissé sans surveillance ne doit
                pas suffire à changer votre mot de passe.
              </p>
            </div>
          )}

          <div>
            <label className={etiquette}>Nouveau mot de passe</label>
            <input
              type="password"
              value={nouveau}
              onChange={e => setNouveau(e.target.value)}
              className={champ}
              autoComplete="new-password"
              autoFocus={provisoire}
            />
            {tropCourt && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">
                {MIN} caractères minimum.
              </p>
            )}
          </div>

          <div>
            <label className={etiquette}>Confirmation</label>
            <input
              type="password"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              className={champ}
              autoComplete="new-password"
            />
            {different && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">
                Les deux saisies diffèrent.
              </p>
            )}
          </div>

          {erreur && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{erreur}</p>}

          {succes && (
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {succes}
            </p>
          )}

          <button
            type="submit"
            disabled={!pret}
            className="w-full py-3 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  );
};
