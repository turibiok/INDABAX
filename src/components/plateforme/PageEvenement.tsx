import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, MapPin, Minus, Plus } from 'lucide-react';

import {
  BilletPropose,
  billetsProposes,
  commander,
  EvenementPublic,
  evenementPublic,
  prix,
} from '../../services/plateforme';
import { periodeEvenement } from '../../eventFormat';

/**
 * Page publique d'un evenement, et son inscription.
 *
 * L'inscription ne demande pas de compte : exiger qu'on s'enregistre sur la
 * plateforme pour prendre un billet gratuit ecarterait la moitie des gens.
 * L'email suffit — c'est lui qui porte les codes.
 */

interface PageEvenementProps {
  slug: string;
  onRetour: () => void;
}

/** Le maximum accepte par commande, aligne sur ce que le serveur refuse. */
const MAX_PAR_COMMANDE = 20;

export const PageEvenement: React.FC<PageEvenementProps> = ({ slug, onRetour }) => {
  const [evenement, setEvenement] = useState<EvenementPublic | null>(null);
  const [billets, setBillets] = useState<BilletPropose[]>([]);
  const [quantites, setQuantites] = useState<Record<string, number>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  useEffect(() => {
    let abandonne = false;

    Promise.all([evenementPublic(slug), billetsProposes(slug).catch(() => ({ tickets: [] }))])
      .then(([e, b]) => {
        if (abandonne) return;
        setEvenement(e.event);
        setBillets(b.tickets);
      })
      .catch(e => {
        if (!abandonne) setErreur(e?.message || 'Événement introuvable.');
      })
      .finally(() => {
        if (!abandonne) setChargement(false);
      });

    return () => {
      abandonne = true;
    };
  }, [slug]);

  const total = Object.entries(quantites).reduce((somme, [id, n]) => {
    const billet = billets.find(b => b.id === id);
    return somme + (billet ? billet.priceMinor * n : 0);
  }, 0);

  const nombre = Object.values(quantites).reduce((a, b) => a + b, 0);
  const devise = billets[0]?.currency || 'XOF';

  const ajuster = (billet: BilletPropose, delta: number) => {
    setQuantites(prev => {
      const actuel = prev[billet.id] || 0;
      let voulu = actuel + delta;

      if (voulu < 0) voulu = 0;

      // On borne ici ce que le serveur refuserait de toute facon : mieux vaut
      // un bouton qui ne bouge plus qu'un refus apres avoir rempli le
      // formulaire.
      if (billet.remaining !== null) voulu = Math.min(voulu, billet.remaining);

      const autres = nombre - actuel;
      voulu = Math.min(voulu, MAX_PAR_COMMANDE - autres);

      const suite = { ...prev };
      if (voulu <= 0) delete suite[billet.id];
      else suite[billet.id] = voulu;
      return suite;
    });
  };

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);

    try {
      const r = await commander(slug, {
        email,
        name: nom,
        phone: telephone,
        lines: Object.entries(quantites).map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
      });

      setCodes(r.tickets.map(t => t.code));
    } catch (e: any) {
      setErreur(e?.message || "L'inscription n'a pas abouti.");

      // Le stock a pu bouger pendant la saisie : on relit plutot que de
      // laisser la personne réessayer contre un état périmé.
      billetsProposes(slug)
        .then(b => setBillets(b.tickets))
        .catch(() => undefined);
    } finally {
      setEnvoi(false);
    }
  };

  const champ =
    'w-full px-3 py-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition';

  if (chargement) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!evenement) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 p-8">
        <button onClick={onRetour} className="text-sm font-bold text-emerald-700 cursor-pointer">
          <ArrowLeft className="w-4 h-4 inline" /> Retour
        </button>
        <p className="mt-4 text-sm text-red-700">{erreur}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="h-2" style={{ backgroundColor: evenement.primaryColor || '#047857' }} />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <button
          onClick={onRetour}
          className="text-sm font-bold text-stone-600 dark:text-stone-400 hover:text-emerald-700 cursor-pointer flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Tous les événements
        </button>

        <div className="grid md:grid-cols-[2fr_3fr] gap-8 items-start">
          {evenement.posterUrl && (
            <img
              src={evenement.posterUrl}
              alt={`Affiche de ${evenement.name}`}
              className="w-full rounded-2xl bg-stone-100 dark:bg-stone-800"
            />
          )}

          <div>
            <h1 className="font-heading font-black text-3xl tracking-tight">
              {evenement.name} {evenement.edition}
            </h1>

            <div className="mt-3 space-y-1.5 text-sm text-stone-600 dark:text-stone-400">
              {periodeEvenement(evenement.startDate, evenement.endDate) && (
                <p className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  {periodeEvenement(evenement.startDate, evenement.endDate)}
                </p>
              )}
              {evenement.location && (
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {evenement.location}
                </p>
              )}
            </div>

            {evenement.summary && (
              <p className="mt-4 text-stone-700 dark:text-stone-300 leading-relaxed">{evenement.summary}</p>
            )}

            {codes ? (
              <div className="mt-8 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="font-heading font-black text-lg text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Inscription enregistrée
                </p>
                <p className="text-sm mt-2 text-stone-700 dark:text-stone-300">
                  Conservez {codes.length > 1 ? 'ces codes' : 'ce code'} : {codes.length > 1 ? 'ils vous seront demandés' : 'il vous sera demandé'} à l’entrée.
                </p>
                <ul className="mt-3 space-y-1">
                  {codes.map(code => (
                    <li key={code} className="font-mono font-bold text-lg tracking-wider">
                      {code}
                    </li>
                  ))}
                </ul>
              </div>
            ) : billets.length === 0 ? (
              <p className="mt-8 text-sm text-stone-500">
                Les inscriptions ne sont pas encore ouvertes.
              </p>
            ) : (
              <form onSubmit={envoyer} className="mt-8 space-y-4">
                <div className="space-y-2">
                  {billets.map(billet => (
                    <div
                      key={billet.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-xl border border-stone-200 dark:border-stone-800"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm">{billet.name}</p>
                        {billet.description && (
                          <p className="text-xs text-stone-500">{billet.description}</p>
                        )}
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {prix(billet.priceMinor, billet.currency)}
                          {billet.remaining !== null && billet.remaining <= 10 && !billet.soldOut && (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              {' '}• {billet.remaining} restant(s)
                            </span>
                          )}
                        </p>
                      </div>

                      {billet.soldOut ? (
                        <span className="text-xs font-bold text-stone-400 shrink-0">Épuisé</span>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => ajuster(billet, -1)}
                            disabled={!quantites[billet.id]}
                            className="w-8 h-8 rounded-lg border border-stone-300 dark:border-stone-700 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold text-sm">
                            {quantites[billet.id] || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() => ajuster(billet, 1)}
                            className="w-8 h-8 rounded-lg border border-stone-300 dark:border-stone-700 flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {nombre > 0 && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Votre email"
                        className={champ}
                      />
                      <input
                        value={nom}
                        onChange={e => setNom(e.target.value)}
                        placeholder="Votre nom"
                        className={champ}
                      />
                      <input
                        value={telephone}
                        onChange={e => setTelephone(e.target.value)}
                        placeholder="Téléphone (facultatif)"
                        className={`${champ} sm:col-span-2`}
                      />
                    </div>

                    {erreur && (
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">{erreur}</p>
                    )}

                    <button
                      type="submit"
                      disabled={envoi || !email.trim()}
                      className="w-full py-3 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                    >
                      {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
                      {total === 0
                        ? `Confirmer — ${nombre} billet(s), gratuit`
                        : `Réserver — ${prix(total, devise)}`}
                    </button>

                    {total > 0 && (
                      <p className="text-xs text-stone-500">
                        La réservation tient vos places. Le règlement se fait auprès de
                        l’organisation.
                      </p>
                    )}
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
