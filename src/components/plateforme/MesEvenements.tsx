import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Eye, EyeOff, Loader2, MapPin, Plus, Ticket } from 'lucide-react';

import {
  ComptePlateforme,
  EvenementGere,
  mesEvenements,
  modifierEvenement,
} from '../../services/plateforme';
import { periodeEvenement } from '../../eventFormat';

/**
 * Ce qu'une personne connectee administre.
 *
 * Le serveur decide de la liste : un organisateur ne reçoit que les siens, un
 * administrateur les reçoit tous. Filtrer dans le navigateur reviendrait a
 * envoyer a chacun les evenements de tout le monde en comptant sur l'interface
 * pour les cacher.
 */

interface MesEvenementsProps {
  onCreer: () => void;
  onOuvrir: (slug: string) => void;
  onVitrine: () => void;
  /** Ouvre le tableau de bord. Proposé aux seuls administrateurs. */
  onPlateforme: () => void;
  /** Ouvre l'espace personnel : état du compte et mot de passe. */
  onMonCompte: () => void;
}

const ETIQUETTE_STATUT: Record<EvenementGere['status'], string> = {
  draft: 'Brouillon',
  published: 'Publié',
  archived: 'Archivé',
};

export const MesEvenements: React.FC<MesEvenementsProps> = ({
  onCreer,
  onOuvrir,
  onVitrine,
  onPlateforme,
  onMonCompte,
}) => {
  const [compte, setCompte] = useState<ComptePlateforme | null>(null);
  const [evenements, setEvenements] = useState<EvenementGere[]>([]);
  const [peutCreer, setPeutCreer] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(() => {
    setChargement(true);

    mesEvenements()
      .then(r => {
        setCompte(r.account);
        setEvenements(r.events);
        setPeutCreer(r.canCreate);
        setErreur(null);
      })
      .catch(e => setErreur(e?.message || 'Impossible de charger vos événements.'))
      .finally(() => setChargement(false));
  }, []);

  useEffect(charger, [charger]);

  /** Publie ou retire de la vitrine. */
  const basculerPublication = async (evenement: EvenementGere) => {
    setEnCours(evenement.slug);
    setErreur(null);

    try {
      const suivant = evenement.status === 'published' ? 'draft' : 'published';
      const r = await modifierEvenement(evenement.slug, { status: suivant });
      setEvenements(prev => prev.map(e => (e.slug === r.event.slug ? r.event : e)));
    } catch (e: any) {
      setErreur(e?.message || "Le changement n'a pas abouti.");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <button onClick={onVitrine} className="font-heading font-black text-xl tracking-tight cursor-pointer">
            Tech<span className="text-emerald-700 dark:text-emerald-400">Event</span>
          </button>

          <div className="flex items-center gap-3">
            {compte && (
              <button
                onClick={onMonCompte}
                title="Mon compte et mon mot de passe"
                className="text-xs text-stone-500 hover:text-emerald-700 cursor-pointer underline underline-offset-2">
                {compte.name} · {compte.role === 'admin' ? 'administrateur' : compte.role === 'organizer' ? 'organisateur' : 'membre'}
              </button>
            )}

            {/*
              * L'entrée n'apparaît que pour un administrateur, mais le serveur
              * refuse de toute façon : cacher un lien ne protège rien.
              */}
            {compte?.role === 'admin' && (
              <button
                onClick={onPlateforme}
                className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer"
              >
                Plateforme
              </button>
            )}

            {peutCreer && (
              <button
                onClick={onCreer}
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5 cursor-pointer transition hover:bg-emerald-800"
              >
                <Plus className="w-4 h-4" /> Nouvel événement
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {chargement && <Loader2 className="w-5 h-5 animate-spin text-stone-400" />}

        {compte && compte.role !== 'member' && !compte.validated && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm font-semibold text-amber-900 dark:text-amber-200">
            Votre compte attend la validation d’un administrateur. Vous pouvez préparer vos
            événements ; leur publication sera possible une fois le compte validé.
          </div>
        )}

        {erreur && (
          <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 text-sm font-semibold">
            {erreur}
          </div>
        )}

        {!chargement && evenements.length === 0 && (
          <p className="text-stone-500">
            {peutCreer
              ? 'Aucun événement pour l’instant.'
              : 'Votre compte ne permet pas encore de créer un événement.'}
          </p>
        )}

        <div className="space-y-3">
          {evenements.map(evenement => (
            <div
              key={evenement.slug}
              className="border border-stone-200 dark:border-stone-800 rounded-2xl p-4 flex items-start gap-4 flex-wrap"
            >
              {evenement.logoUrl ? (
                <img
                  src={evenement.logoUrl}
                  alt=""
                  className="w-12 h-12 object-contain rounded-xl bg-stone-100 dark:bg-stone-800 shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl shrink-0"
                  style={{ backgroundColor: evenement.primaryColor || '#047857' }}
                />
              )}

              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-heading font-black">
                    {evenement.name} {evenement.edition}
                  </h2>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      evenement.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                        : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {ETIQUETTE_STATUT[evenement.status]}
                  </span>
                </div>

                <div className="mt-1 text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                  {periodeEvenement(evenement.startDate, evenement.endDate) && (
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      {periodeEvenement(evenement.startDate, evenement.endDate)}
                    </p>
                  )}
                  {evenement.location && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {evenement.location}
                    </p>
                  )}
                  {!evenement.sheetUrl && (
                    <p className="text-amber-700 dark:text-amber-400">
                      Aucun classeur : le programme et les inscrits ne peuvent pas être lus.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onOuvrir(evenement.slug)}
                  className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Ticket className="w-3.5 h-3.5" /> Billets
                </button>

                <button
                  onClick={() => basculerPublication(evenement)}
                  disabled={enCours === evenement.slug}
                  className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  {enCours === evenement.slug ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : evenement.status === 'published' ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  {evenement.status === 'published' ? 'Retirer' : 'Publier'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
