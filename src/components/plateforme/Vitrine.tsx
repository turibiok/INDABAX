import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Loader2, MapPin, Ticket } from 'lucide-react';

import { EvenementPublic, evenementsPublies } from '../../services/plateforme';
import { ligneEvenement, periodeEvenement } from '../../eventFormat';

/**
 * Vitrine publique de Tech Event.
 *
 * Ouverte sans connexion : c'est par elle qu'on decouvre un evenement, et
 * exiger un compte pour seulement regarder l'affiche ecarterait ceux qu'on
 * cherche a atteindre.
 */

interface VitrineProps {
  /** Ouvre la page d'un evenement. */
  onOuvrir: (slug: string) => void;
  /** Ouvre l'ecran de connexion de la plateforme. */
  onConnexion: () => void;
}

/** Les evenements a venir d'abord, puis les plus proches. */
function parProximite(a: EvenementPublic, b: EvenementPublic): number {
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const aPasse = Boolean(a.endDate) && a.endDate < aujourdhui;
  const bPasse = Boolean(b.endDate) && b.endDate < aujourdhui;
  if (aPasse !== bPasse) return aPasse ? 1 : -1;

  // Sans date, un evenement passe apres ceux qui en ont une : il ne peut pas
  // etre situe dans le temps, donc pas mis en avant.
  if (!a.startDate) return 1;
  if (!b.startDate) return -1;

  return aPasse ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate);
}

const Affiche: React.FC<{ evenement: EvenementPublic }> = ({ evenement }) => {
  const [cassee, setCassee] = useState(false);

  /*
   * L'affiche vient d'un lien fourni par l'organisateur : elle peut avoir
   * disparu. Un a-plat aux couleurs de l'evenement vaut mieux qu'une icone
   * d'image brisee sur la page d'accueil de la plateforme.
   */
  if (!evenement.posterUrl || cassee) {
    return (
      <div
        className="w-full aspect-[3/4] rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: evenement.primaryColor || '#047857' }}
      >
        <span className="font-heading font-black text-white/90 text-xl text-center px-4">
          {evenement.name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={evenement.posterUrl}
      alt={`Affiche de ${evenement.name}`}
      loading="lazy"
      onError={() => setCassee(true)}
      className="w-full aspect-[3/4] object-cover rounded-2xl bg-stone-100 dark:bg-stone-800"
    />
  );
};

export const Vitrine: React.FC<VitrineProps> = ({ onOuvrir, onConnexion }) => {
  const [evenements, setEvenements] = useState<EvenementPublic[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let abandonne = false;

    evenementsPublies()
      .then(r => {
        if (!abandonne) setEvenements([...r.events].sort(parProximite));
      })
      .catch(e => {
        if (!abandonne) setErreur(e?.message || 'Impossible de charger les événements.');
      })
      .finally(() => {
        if (!abandonne) setChargement(false);
      });

    return () => {
      abandonne = true;
    };
  }, []);

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <span className="font-heading font-black text-xl tracking-tight">
            Tech<span className="text-emerald-700 dark:text-emerald-400">Event</span>
          </span>

          <button
            onClick={onConnexion}
            className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold cursor-pointer transition hover:bg-emerald-800"
          >
            Se connecter
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {chargement && (
          <div className="flex items-center gap-2 text-stone-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        )}

        {erreur && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 text-sm font-semibold">
            {erreur}
          </div>
        )}

        {!chargement && !erreur && evenements.length === 0 && (
          <p className="text-stone-500">Aucun événement publié pour le moment.</p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {evenements.map(evenement => {
            const passe = Boolean(evenement.endDate) && evenement.endDate < aujourdhui;

            return (
              <button
                key={evenement.slug}
                onClick={() => onOuvrir(evenement.slug)}
                className={`text-left group cursor-pointer ${passe ? 'opacity-60' : ''}`}
              >
                <Affiche evenement={evenement} />

                <div className="mt-3 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <h2 className="font-heading font-black text-lg leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">
                      {evenement.name}
                    </h2>
                    {evenement.edition && (
                      <span className="text-xs font-bold text-stone-500 shrink-0">{evenement.edition}</span>
                    )}
                  </div>

                  {periodeEvenement(evenement.startDate, evenement.endDate) && (
                    <p className="text-xs text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      {periodeEvenement(evenement.startDate, evenement.endDate)}
                      {passe && ' — terminé'}
                    </p>
                  )}

                  {evenement.location && (
                    <p className="text-xs text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {evenement.location}
                    </p>
                  )}

                  {evenement.summary && (
                    <p className="text-sm text-stone-700 dark:text-stone-300 line-clamp-2 pt-1">
                      {evenement.summary}
                    </p>
                  )}

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 pt-1">
                    {passe ? 'Voir' : 'S’inscrire'} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-8 border-t border-stone-200 dark:border-stone-800 mt-10">
        <p className="text-xs text-stone-500 flex items-center gap-1.5">
          <Ticket className="w-3.5 h-3.5" />
          {ligneEvenement('Tech Event', `${evenements.length} événement(s) publié(s)`)}
        </p>
      </footer>
    </div>
  );
};
