import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImageOff, Loader2 } from 'lucide-react';

import { BrouillonEvenement, creerEvenement } from '../../services/plateforme';
import { periodeEvenement } from '../../eventFormat';

/**
 * Creation d'un evenement, en trois temps.
 *
 * Trois etapes plutot qu'un formulaire unique, parce que seules les trois
 * premieres valeurs sont indispensables : on peut creer un evenement en
 * trente secondes et revenir plus tard pour l'affiche et le classeur. Un
 * formulaire d'un seul tenant donnerait l'impression qu'il faut tout savoir
 * d'avance.
 *
 * L'evenement nait en brouillon. Le publier est un geste distinct, pour qu'une
 * saisie a moitie faite n'apparaisse pas sur la vitrine.
 */

interface CreerEvenementProps {
  onCree: (slug: string) => void;
  onAnnuler: () => void;
}

type Etape = 'identite' | 'apparence' | 'donnees';

const ETAPES: { id: Etape; titre: string }[] = [
  { id: 'identite', titre: 'L’événement' },
  { id: 'apparence', titre: 'L’identité visuelle' },
  { id: 'donnees', titre: 'Le classeur' },
];

/** Apercu d'une image distante, qui dit quand le lien ne mene a rien. */
const Apercu: React.FC<{ url: string; ratio: string; libelle: string }> = ({ url, ratio, libelle }) => {
  const [cassee, setCassee] = useState(false);

  React.useEffect(() => setCassee(false), [url]);

  if (!url.trim()) return null;

  if (cassee) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mt-1.5">
        <ImageOff className="w-3.5 h-3.5 shrink-0" />
        Ce lien ne mène à aucune image consultable.
      </p>
    );
  }

  return (
    <img
      src={url}
      alt={libelle}
      onError={() => setCassee(true)}
      className={`mt-2 ${ratio} object-contain rounded-xl bg-stone-100 dark:bg-stone-800`}
    />
  );
};

export const CreerEvenement: React.FC<CreerEvenementProps> = ({ onCree, onAnnuler }) => {
  const [etape, setEtape] = useState<Etape>('identite');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [brouillon, setBrouillon] = useState<BrouillonEvenement>({
    name: '',
    edition: String(new Date().getFullYear()),
    startDate: '',
    endDate: '',
    location: '',
    summary: '',
    logoUrl: '',
    posterUrl: '',
    primaryColor: '#047857',
    sheetUrl: '',
    appsScriptUrl: '',
  });

  const poser = (patch: BrouillonEvenement) => setBrouillon(prev => ({ ...prev, ...patch }));

  /** Ce qui manque pour pouvoir créer, dans l'ordre où on le saisit. */
  const manques: string[] = [];
  if (!(brouillon.name || '').trim()) manques.push('un nom');
  if (!(brouillon.startDate || '').trim()) manques.push('une date de début');
  if (!(brouillon.endDate || '').trim()) manques.push('une date de fin');
  if (
    brouillon.startDate &&
    brouillon.endDate &&
    brouillon.endDate < brouillon.startDate
  ) {
    manques.push('une date de fin postérieure au début');
  }

  const complet = manques.length === 0;

  const envoyer = async () => {
    setEnvoi(true);
    setErreur(null);

    try {
      const r = await creerEvenement(brouillon);
      onCree(r.event.slug);
    } catch (e: any) {
      setErreur(e?.message || "L'événement n'a pas pu être créé.");
    } finally {
      setEnvoi(false);
    }
  };

  const champ =
    'w-full px-3 py-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition';
  const etiquette =
    'text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5';

  const index = ETAPES.findIndex(e => e.id === etape);

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={onAnnuler}
          className="text-sm font-bold text-stone-600 dark:text-stone-400 hover:text-emerald-700 cursor-pointer flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Mes événements
        </button>

        <h1 className="font-heading font-black text-2xl tracking-tight">Nouvel événement</h1>

        <div className="flex items-center gap-2 mt-5 mb-7">
          {ETAPES.map((e, i) => (
            <React.Fragment key={e.id}>
              <button
                onClick={() => setEtape(e.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition cursor-pointer ${
                  i === index
                    ? 'bg-emerald-700 text-white'
                    : i < index
                      ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                }`}
              >
                {e.titre}
              </button>
              {i < ETAPES.length - 1 && <span className="text-stone-300 dark:text-stone-700">—</span>}
            </React.Fragment>
          ))}
        </div>

        {etape === 'identite' && (
          <div className="space-y-4">
            <div>
              <label className={etiquette}>Nom de l’événement</label>
              <input
                value={brouillon.name || ''}
                onChange={e => poser({ name: e.target.value })}
                placeholder="Forum du Numérique"
                className={champ}
                autoFocus
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={etiquette}>Édition</label>
                <input
                  value={brouillon.edition || ''}
                  onChange={e => poser({ edition: e.target.value })}
                  placeholder="2027"
                  className={champ}
                />
              </div>
              <div>
                <label className={etiquette}>Début</label>
                <input
                  type="date"
                  value={brouillon.startDate || ''}
                  onChange={e => poser({ startDate: e.target.value })}
                  className={champ}
                />
              </div>
              <div>
                <label className={etiquette}>Fin</label>
                <input
                  type="date"
                  value={brouillon.endDate || ''}
                  onChange={e => poser({ endDate: e.target.value })}
                  className={champ}
                />
              </div>
            </div>

            {periodeEvenement(brouillon.startDate || '', brouillon.endDate || '') && (
              <p className="text-xs text-stone-500">
                S’affichera : {periodeEvenement(brouillon.startDate || '', brouillon.endDate || '')}
              </p>
            )}

            <div>
              <label className={etiquette}>Lieu</label>
              <input
                value={brouillon.location || ''}
                onChange={e => poser({ location: e.target.value })}
                placeholder="Cotonou, Bénin"
                className={champ}
              />
            </div>

            <div>
              <label className={etiquette}>En une phrase</label>
              <textarea
                value={brouillon.summary || ''}
                onChange={e => poser({ summary: e.target.value })}
                rows={2}
                placeholder="Ce que les gens y trouveront."
                className={champ}
              />
            </div>
          </div>
        )}

        {etape === 'apparence' && (
          <div className="space-y-4">
            <div>
              <label className={etiquette}>Affiche</label>
              <input
                value={brouillon.posterUrl || ''}
                onChange={e => poser({ posterUrl: e.target.value })}
                placeholder="https://…/affiche.jpg"
                className={champ}
              />
              <Apercu url={brouillon.posterUrl || ''} ratio="max-h-64" libelle="Affiche" />
            </div>

            <div>
              <label className={etiquette}>Logo</label>
              <input
                value={brouillon.logoUrl || ''}
                onChange={e => poser({ logoUrl: e.target.value })}
                placeholder="https://…/logo.png"
                className={champ}
              />
              <Apercu url={brouillon.logoUrl || ''} ratio="max-h-20" libelle="Logo" />
            </div>

            <div>
              <label className={etiquette}>Couleur dominante</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brouillon.primaryColor || '#047857'}
                  onChange={e => poser({ primaryColor: e.target.value })}
                  className="w-12 h-10 rounded-lg border border-stone-300 dark:border-stone-700 cursor-pointer"
                />
                <input
                  value={brouillon.primaryColor || ''}
                  onChange={e => poser({ primaryColor: e.target.value })}
                  className={champ}
                />
              </div>
            </div>

            {/*
              * Des liens, et non des fichiers déposés : la plateforme ne stocke
              * aucune image, ce qui lui évite d'héberger ce qu'elle ne
              * contrôle pas. Une image d'un hébergeur public convient.
              */}
            <p className="text-xs text-stone-500">
              Les images restent chez vous : collez un lien public.
            </p>
          </div>
        )}

        {etape === 'donnees' && (
          <div className="space-y-4">
            <div>
              <label className={etiquette}>Classeur Google de l’événement</label>
              <input
                value={brouillon.sheetUrl || ''}
                onChange={e => poser({ sheetUrl: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className={champ}
              />
            </div>

            <div>
              <label className={etiquette}>Apps Script déployé sur ce classeur</label>
              <input
                value={brouillon.appsScriptUrl || ''}
                onChange={e => poser({ appsScriptUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/…/exec"
                className={champ}
              />
            </div>

            <p className="text-xs text-stone-500">
              Chaque événement garde son propre classeur : aucune de vos données ne
              croise celles d’un autre organisateur. Vous pouvez les renseigner plus tard.
            </p>
          </div>
        )}

        {erreur && (
          <p className="mt-5 text-sm font-semibold text-red-700 dark:text-red-400">{erreur}</p>
        )}

        <div className="flex items-center gap-2 mt-7 flex-wrap">
          {index > 0 && (
            <button
              onClick={() => setEtape(ETAPES[index - 1].id)}
              className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-bold cursor-pointer"
            >
              Précédent
            </button>
          )}

          {index < ETAPES.length - 1 ? (
            <button
              onClick={() => setEtape(ETAPES[index + 1].id)}
              className="px-5 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              Suivant <ArrowRight className="w-4 h-4" />
            </button>
          ) : null}

          <button
            onClick={envoyer}
            disabled={!complet || envoi}
            title={complet ? undefined : `Il manque ${manques.join(', ')}.`}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Créer en brouillon
          </button>
        </div>

        {!complet && (
          <p className="mt-3 text-xs text-stone-500">Il manque {manques.join(', ')}.</p>
        )}
      </div>
    </div>
  );
};
