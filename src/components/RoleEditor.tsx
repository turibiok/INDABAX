import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { useEvent } from '../context/EventContext';
import { DEFAULT_ROLES } from '../permissions';
import { ACCENTS_DISPONIBLES, classesPourAccent } from '../roleAccents';
import { AppTab, DashboardKind, EventRole, RoleAccent } from '../types';

/**
 * Definition des roles de l'evenement.
 *
 * Les six roles livres conviennent a un colloque ; un stage de secourisme, un
 * tournoi ou un mariage ont les leurs. Cet ecran permet de les definir sans
 * toucher au code — et sans passer par le classeur, meme si le classeur reste
 * modifiable a la main pour qui prefere.
 *
 * Ce qui est enregistre ici decide de ce que chacun a le droit de faire. Le
 * serveur ne fait donc pas confiance a ce formulaire : il relit la table qu'il
 * vient d'ecrire, garde-fous compris, et c'est cette relecture qui fait foi.
 */

const ONGLETS: { id: AppTab; label: string }[] = [
  { id: 'schedule', label: 'Programme' },
  { id: 'announcements', label: 'Annonces' },
  { id: 'discussions', label: 'Discussions' },
  { id: 'dashboard', label: 'Mon espace' },
  { id: 'networking', label: 'Réseautage' },
  { id: 'profile', label: 'Profil' },
  { id: 'badge', label: 'Badge' },
  { id: 'ai-guide', label: 'Guide IA' },
];

const ESPACES: { id: DashboardKind; label: string; aide: string }[] = [
  { id: 'admin', label: 'Administration', aide: 'Rôles, paramètres et classeur' },
  { id: 'organizer', label: 'Organisation', aide: 'Pilotage, inscriptions, contenus' },
  { id: 'speaker', label: 'Intervention', aide: 'Ses interventions et ses retours' },
  { id: 'volunteer', label: 'Terrain', aide: 'Missions et émargements' },
  { id: 'attendee', label: 'Participation', aide: 'Son parcours personnel' },
];

const DROITS: { cle: keyof EventRole; label: string; aide: string }[] = [
  { cle: 'canScan', label: 'Scanner', aide: 'Valider les présences par QR code' },
  { cle: 'canBroadcast', label: 'Diffuser', aide: 'Publier des annonces à tous' },
  { cle: 'canManageContent', label: 'Gérer le contenu', aide: 'Créer et modifier sessions et personnes' },
  { cle: 'canManageRoles', label: 'Gérer les rôles', aide: 'Attribuer les rôles et définir cette table' },
  { cle: 'canManageIntegrations', label: 'Gérer le classeur', aide: 'Lier le classeur et synchroniser' },
  { cle: 'canExport', label: 'Exporter', aide: 'Télécharger les données' },
  { cle: 'canSeeAllFeedback', label: 'Voir tous les avis', aide: 'Et pas seulement les siens' },
  { cle: 'canImportData', label: 'Importer', aide: 'Charger des données en masse' },
];

/** Transforme un libelle en identifiant utilisable comme cle. */
function versIdentifiant(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const RoleEditor: React.FC = () => {
  const { eventConfig, updateEventRoles, capabilities } = useEvent();

  const rolesEnVigueur = useMemo(
    () => (eventConfig.roles?.length ? eventConfig.roles : DEFAULT_ROLES),
    [eventConfig.roles],
  );

  const [brouillon, setBrouillon] = useState<EventRole[]>(rolesEnVigueur);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<{ texte: string; ok: boolean } | null>(null);
  const [nouveauLibelle, setNouveauLibelle] = useState('');

  const modifie = JSON.stringify(brouillon) !== JSON.stringify(rolesEnVigueur);

  /*
   * Une table sans personne pour gérer les rôles enfermerait l'événement :
   * plus aucun compte ne pourrait la corriger. Le serveur la refuserait de
   * toute façon, mais l'expliquer ici évite de laisser quelqu'un remplir un
   * formulaire entier pour rien.
   */
  const sansGestionnaire = !brouillon.some(role => role.canManageRoles);

  if (!capabilities.canManageRoles) {
    return (
      <div className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-800 text-sm text-stone-600 dark:text-stone-300">
        La définition des rôles est réservée aux comptes qui peuvent les attribuer.
      </div>
    );
  }

  const modifier = (id: string, patch: Partial<EventRole>) => {
    setBrouillon(prev => prev.map(role => (role.id === id ? { ...role, ...patch } : role)));
  };

  const basculerOnglet = (id: string, onglet: AppTab) => {
    setBrouillon(prev =>
      prev.map(role => {
        if (role.id !== id) return role;
        const present = role.tabs.includes(onglet);
        const tabs = present ? role.tabs.filter(t => t !== onglet) : [...role.tabs, onglet];
        // Un rôle sans aucun onglet n'aurait plus d'interface du tout.
        return { ...role, tabs: tabs.length > 0 ? tabs : role.tabs };
      }),
    );
  };

  const ajouter = () => {
    const libelle = nouveauLibelle.trim();
    if (!libelle) return;

    const base = versIdentifiant(libelle) || 'role';
    let id = base;
    let suffixe = 2;
    while (brouillon.some(role => role.id === id)) id = `${base}-${suffixe++}`;

    setBrouillon(prev => [
      ...prev,
      {
        id,
        label: libelle,
        dashboardLabel: `Espace ${libelle}`,
        dashboard: 'attendee',
        accent: 'ciel',
        tabs: ['schedule', 'announcements', 'dashboard', 'profile', 'badge'],
        canScan: false,
        canBroadcast: false,
        canManageContent: false,
        canManageRoles: false,
        canManageIntegrations: false,
        canExport: false,
        canSeeAllFeedback: false,
        canImportData: false,
      },
    ]);

    setNouveauLibelle('');
  };

  const supprimer = (id: string) => {
    setBrouillon(prev => prev.filter(role => role.id !== id));
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    const resultat = await updateEventRoles(brouillon);
    setEnregistrement(false);
    setMessage({ texte: resultat.message, ok: resultat.success });

    if (resultat.success) setTimeout(() => setMessage(null), 4000);
  };

  const champ =
    'w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition';

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-heading font-black text-lg">Rôles de l'événement</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Chaque rôle porte ses propres droits. Ce qui est coché ici décide de ce que les
            personnes peuvent faire — c'est le serveur qui l'applique, à chaque requête.
          </p>
        </div>
      </div>

      {sansGestionnaire && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <span className="text-sm font-semibold">
            Aucun rôle ne peut plus gérer les rôles. Plus personne ne pourrait corriger cette
            table : cochez « Gérer les rôles » pour au moins un rôle.
          </span>
        </div>
      )}

      {message && (
        <div
          className={`p-4 rounded-2xl flex items-start gap-3 text-sm font-semibold ${
            message.ok
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300'
          }`}
        >
          {message.ok ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{message.texte}</span>
        </div>
      )}

      <div className="space-y-3">
        {brouillon.map(role => (
          <div
            key={role.id}
            className="border border-stone-200 dark:border-stone-800 rounded-2xl p-4 bg-stone-50 dark:bg-stone-900/50 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
                  Libellé
                </label>
                <input
                  value={role.label}
                  onChange={e => modifier(role.id, { label: e.target.value })}
                  className={champ}
                />
                <p className="text-[11px] text-stone-500 mt-1 font-mono">
                  identifiant : {role.id}
                  {role.builtIn && ' • rôle livré'}
                </p>
              </div>

              {/*
                * Les rôles livrés ne se suppriment pas : leur identifiant est
                * écrit dans les comptes déjà enregistrés, qui se retrouveraient
                * sans rôle connu.
                */}
              {!role.builtIn && (
                <button
                  type="button"
                  onClick={() => supprimer(role.id)}
                  className="mt-6 p-2 rounded-xl text-red-600 hover:bg-red-500/10 transition cursor-pointer"
                  title="Supprimer ce rôle"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
                  Espace personnel
                </label>
                <select
                  value={role.dashboard}
                  onChange={e => modifier(role.id, { dashboard: e.target.value as DashboardKind })}
                  className={champ}
                >
                  {ESPACES.map(espace => (
                    <option key={espace.id} value={espace.id}>
                      {espace.label} — {espace.aide}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
                  Teinte du badge
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ACCENTS_DISPONIBLES.map(accent => (
                    <button
                      key={accent}
                      type="button"
                      onClick={() => modifier(role.id, { accent: accent as RoleAccent })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                        classesPourAccent(accent).plein
                      } ${role.accent === accent ? 'ring-2 ring-offset-1 ring-stone-900 dark:ring-white' : 'opacity-60 hover:opacity-100'}`}
                    >
                      {accent}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
                Onglets visibles
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ONGLETS.map(onglet => {
                  const actif = role.tabs.includes(onglet.id);
                  return (
                    <button
                      key={onglet.id}
                      type="button"
                      onClick={() => basculerOnglet(role.id, onglet.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        actif
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-stone-900 text-stone-500 border-stone-300 dark:border-stone-700 hover:border-emerald-500'
                      }`}
                    >
                      {onglet.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
                Droits
              </label>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {DROITS.map(droit => (
                  <label
                    key={String(droit.cle)}
                    className="flex items-start gap-2 p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(role[droit.cle])}
                      onChange={e => modifier(role.id, { [droit.cle]: e.target.checked } as Partial<EventRole>)}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <span className="text-xs">
                      <span className="font-bold block">{droit.label}</span>
                      <span className="text-stone-500">{droit.aide}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 flex-wrap p-4 border border-dashed border-stone-300 dark:border-stone-700 rounded-2xl">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
            Nouveau rôle
          </label>
          <input
            value={nouveauLibelle}
            onChange={e => setNouveauLibelle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                ajouter();
              }
            }}
            placeholder="Jury, Formateur, Exposant…"
            className={champ}
          />
        </div>
        <button
          type="button"
          onClick={ajouter}
          disabled={!nouveauLibelle.trim()}
          className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={enregistrer}
          disabled={!modifie || enregistrement || sansGestionnaire}
          className="px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          {enregistrement ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {enregistrement ? 'Enregistrement…' : 'Enregistrer dans le classeur'}
        </button>

        <button
          type="button"
          onClick={() => setBrouillon(rolesEnVigueur)}
          disabled={!modifie || enregistrement}
          className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          <RotateCcw size={16} /> Annuler les modifications
        </button>
      </div>
    </div>
  );
};
