import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Loader2, Search, Ticket, XCircle } from 'lucide-react';

import { CommandeDuParticipant, evenementPublic, mesBillets, prix } from '../../services/plateforme';

/**
 * Un participant retrouve ses commandes et ses billets.
 *
 * Sans compte : quelqu'un qui a acheté un billet n'a aucune raison d'en avoir
 * un. Il donne la référence reçue à l'achat et l'adresse utilisée — les deux,
 * parce qu'une référence égarée dans un historique de navigateur ne doit pas
 * suffire à lire la commande de quelqu'un d'autre.
 */

interface MesBilletsProps {
  slug: string;
  onRetour: () => void;
}

const ETAT: Record<
  string,
  { texte: string; classe: string; icone: React.ComponentType<{ className?: string }> }
> = {
  paid: {
    texte: 'Réglée',
    classe: 'text-emerald-700 dark:text-emerald-400',
    icone: CheckCircle2,
  },
  pending: {
    texte: 'En attente de paiement',
    classe: 'text-amber-700 dark:text-amber-400',
    icone: Clock,
  },
  cancelled: { texte: 'Annulée', classe: 'text-stone-500', icone: XCircle },
  refunded: { texte: 'Remboursée', classe: 'text-stone-500', icone: XCircle },
};

export const MesBillets: React.FC<MesBilletsProps> = ({ slug, onRetour }) => {
  /*
   * Le nom de l'evenement est lu ici plutot que recu : la vue qui mene a cet
   * ecran ne connait que le slug, et afficher « vitrine-essai » en titre
   * donnerait l'impression de s'etre trompe d'adresse.
   */
  const [nomEvenement, setNomEvenement] = useState(slug);

  useEffect(() => {
    evenementPublic(slug)
      .then(r => setNomEvenement([r.event.name, r.event.edition].filter(Boolean).join(' ')))
      // Le nom n'est qu'un titre : son absence ne doit pas empecher de
      // retrouver ses billets.
      .catch(() => undefined);
  }, [slug]);

  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [commandes, setCommandes] = useState<CommandeDuParticipant[] | null>(null);

  const chercher = async (e: React.FormEvent) => {
    e.preventDefault();
    setChargement(true);
    setErreur(null);
    setCommandes(null);

    try {
      setCommandes(await mesBillets(slug, reference.trim(), email.trim()));
    } catch (e: any) {
      setErreur(e?.message || 'La recherche a échoué.');
    } finally {
      setChargement(false);
    }
  };

  const champ =
    'w-full px-3 py-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition';
  const etiquette =
    'text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5';

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={onRetour}
          className="text-sm font-bold text-stone-600 dark:text-stone-400 hover:text-emerald-700 cursor-pointer flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <h1 className="font-heading font-black text-2xl tracking-tight">Mes billets</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">{nomEvenement}</p>

        <form onSubmit={chercher} className="mt-6 space-y-4">
          <div>
            <label className={etiquette}>Référence de la commande</label>
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              className={`${champ} font-mono`}
              placeholder="par exemple 004d9a73-…"
              autoComplete="off"
            />
            <p className="text-xs text-stone-500 mt-1.5">
              Elle vous a été donnée au moment de l’achat.
            </p>
          </div>

          <div>
            <label className={etiquette}>Adresse e-mail utilisée pour l’achat</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={champ}
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={!reference.trim() || !email.trim() || chargement}
            className="w-full py-3 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            {chargement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Retrouver mes billets
          </button>
        </form>

        {erreur && (
          <div className="mt-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{erreur}</p>
          </div>
        )}

        {commandes?.length === 0 && (
          <p className="mt-6 text-sm text-stone-600 dark:text-stone-400">
            Aucune commande sur cet événement.
          </p>
        )}

        {commandes && commandes.length > 0 && (
          <>
            <h2 className="font-heading font-black text-lg mt-9 mb-3">
              {commandes.length === 1 ? 'Votre commande' : `Vos ${commandes.length} commandes`}
            </h2>

            <div className="space-y-4">
              {commandes.map(({ order, billets }) => {
                const etat = ETAT[order.status] || ETAT.pending;
                const Icone = etat.icone;
                const utilisable = order.status === 'paid';

                return (
                  <div
                    key={order.id}
                    className="border border-stone-200 dark:border-stone-800 rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className={`text-sm font-bold flex items-center gap-1.5 ${etat.classe}`}>
                          <Icone className="w-4 h-4" /> {etat.texte}
                        </p>
                        <p className="font-mono text-[11px] text-stone-500 mt-1">{order.id}</p>
                      </div>

                      <p className="font-heading font-black text-lg">
                        {prix(order.totalMinor, order.currency)}
                      </p>
                    </div>

                    {/*
                      * Les billets existent dès la commande — c'est ainsi que le stock
                      * est tenu — mais un code ne vaut qu'une fois la commande réglée.
                      * Le dire ici évite qu'on se présente à l'entrée avec un code sans
                      * valeur, persuadé d'avoir son billet.
                      */}
                    {!utilisable && billets.length > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-3 font-semibold">
                        Ces codes ne seront valables qu’une fois la commande réglée.
                      </p>
                    )}

                    {billets.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {billets.map(billet => (
                          <div
                            key={billet.code}
                            className={`flex items-center gap-3 p-3 rounded-xl border ${
                              utilisable
                                ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-500/5'
                                : 'border-stone-200 dark:border-stone-800'
                            }`}
                          >
                            <Ticket
                              className={`w-4 h-4 shrink-0 ${
                                utilisable ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-400'
                              }`}
                            />

                            <div className="flex-1 min-w-0">
                              <p className="font-mono font-bold text-sm tracking-wide">{billet.code}</p>
                              {billet.holderName && (
                                <p className="text-xs text-stone-500">{billet.holderName}</p>
                              )}
                            </div>

                            {billet.usedAt && (
                              <span className="text-[11px] font-bold text-stone-500 shrink-0">
                                déjà utilisé
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-stone-500 mt-5">
              Présentez le code de chaque billet à l’entrée. Un billet ne sert qu’une fois.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
