import React, { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { connexionPlateforme, inscrireOrganisateur } from '../../services/plateforme';

/**
 * Connexion et inscription a la plateforme.
 *
 * Distincte de la connexion a un evenement : ce sont deux annuaires separes, et
 * les confondre reviendrait a laisser un participant d'un evenement entrer dans
 * l'espace d'organisation d'un autre.
 *
 * L'inscription est ouverte, conformement au choix fait pour la plateforme. Le
 * serveur repond la meme chose que l'adresse soit libre ou deja prise : sans
 * cela, ce formulaire servirait a decouvrir qui possede un compte.
 */

interface ConnexionPlateformeProps {
  onConnecte: () => void;
  onRetour: () => void;
}

const MIN_MOT_DE_PASSE = 8;

export const ConnexionPlateforme: React.FC<ConnexionPlateformeProps> = ({ onConnecte, onRetour }) => {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avis, setAvis] = useState<string | null>(null);

  const tropCourt = motDePasse.length > 0 && motDePasse.length < MIN_MOT_DE_PASSE;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    setAvis(null);

    try {
      if (mode === 'inscription') {
        const r = await inscrireOrganisateur({ email, name: nom, password: motDePasse });
        setAvis(r.message);
        setMode('connexion');
      } else {
        await connexionPlateforme(email, motDePasse);
        onConnecte();
      }
    } catch (e: any) {
      setErreur(e?.message || "L'opération n'a pas abouti.");
    } finally {
      setEnvoi(false);
    }
  };

  const champ =
    'w-full px-3 py-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition';
  const etiquette =
    'text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5';

  const pret =
    email.trim().length > 0 &&
    motDePasse.length >= (mode === 'inscription' ? MIN_MOT_DE_PASSE : 1) &&
    !envoi;

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col">
      <div className="max-w-md w-full mx-auto px-4 py-10">
        <button
          onClick={onRetour}
          className="text-sm font-bold text-stone-600 dark:text-stone-400 hover:text-emerald-700 cursor-pointer flex items-center gap-1.5 mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Les événements
        </button>

        <span className="font-heading font-black text-xl tracking-tight">
          Tech<span className="text-emerald-700 dark:text-emerald-400">Event</span>
        </span>

        <div className="flex gap-2 mt-6 mb-6">
          {(['connexion', 'inscription'] as const).map(m => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setErreur(null);
                setAvis(null);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition ${
                mode === m
                  ? 'bg-emerald-700 text-white'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
              }`}
            >
              {m === 'connexion' ? 'Se connecter' : 'Organiser un événement'}
            </button>
          ))}
        </div>

        <form onSubmit={envoyer} className="space-y-4">
          {mode === 'inscription' && (
            <div>
              <label className={etiquette}>Votre nom</label>
              <input value={nom} onChange={e => setNom(e.target.value)} className={champ} />
            </div>
          )}

          <div>
            <label className={etiquette}>Adresse email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={champ}
              autoFocus
            />
          </div>

          <div>
            <label className={etiquette}>Mot de passe</label>
            <input
              type="password"
              required
              value={motDePasse}
              onChange={e => setMotDePasse(e.target.value)}
              className={champ}
            />
            {mode === 'inscription' && tropCourt && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">
                {MIN_MOT_DE_PASSE} caractères minimum.
              </p>
            )}
          </div>

          {erreur && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{erreur}</p>}
          {avis && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{avis}</p>}

          <button
            type="submit"
            disabled={!pret}
            className="w-full py-3 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'connexion' ? 'Entrer' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
};
