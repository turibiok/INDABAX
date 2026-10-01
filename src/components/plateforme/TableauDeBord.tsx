import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  Ticket,
  Users,
} from 'lucide-react';

import {
  ComptePlateforme,
  depannerMotDePasse,
  EvenementGere,
  chiffresPlateforme,
  modifierCompte,
  StatistiquesPlateforme,
  tableauDeBord,
  validerCompte,
} from '../../services/plateforme';
import { prix } from '../../services/plateforme';

/**
 * Tableau de bord de la plateforme.
 *
 * Reserve aux administrateurs, et le serveur le verifie a chaque requete :
 * cacher un menu ne protege rien, quiconque connait l'adresse pouvant
 * l'appeler directement.
 *
 * Deux choses seulement s'y font : regarder les chiffres, et changer le role
 * ou la suspension d'un compte. Modifier un evenement reste du ressort de son
 * organisateur — un administrateur qui reecrit l'evenement d'un autre sans
 * qu'il le sache serait pire qu'un administrateur qui ne le peut pas.
 */

interface TableauDeBordProps {
  onRetour: () => void;
}

const ROLES: { id: ComptePlateforme['role']; label: string }[] = [
  { id: 'admin', label: 'Administrateur' },
  { id: 'organizer', label: 'Organisateur' },
  { id: 'member', label: 'Membre' },
];

const Chiffre: React.FC<{ valeur: React.ReactNode; libelle: string; icone?: React.ReactNode }> = ({
  valeur,
  libelle,
  icone,
}) => (
  <div className="border border-stone-200 dark:border-stone-800 rounded-2xl p-4">
    <div className="flex items-center gap-2 text-stone-500">
      {icone}
      <span className="text-[11px] font-bold uppercase tracking-wider">{libelle}</span>
    </div>
    <p className="font-heading font-black text-2xl mt-1">{valeur}</p>
  </div>
);

export const TableauDeBord: React.FC<TableauDeBordProps> = ({ onRetour }) => {
  const [chiffres, setChiffres] = useState<StatistiquesPlateforme | null>(null);
  const [comptes, setComptes] = useState<ComptePlateforme[]>([]);
  const [evenements, setEvenements] = useState<EvenementGere[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  /**
   * Le mot de passe provisoire qui vient d'etre emis.
   *
   * Garde a l'ecran jusqu'a ce qu'on le ferme : le serveur ne le conserve pas
   * en clair, et il ne sera plus jamais consultable. Le faire disparaitre tout
   * seul obligerait a en emettre un autre.
   */
  const [provisoire, setProvisoire] = useState<{ email: string; motDePasse: string } | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      const [bord, stats] = await Promise.all([tableauDeBord(), chiffresPlateforme()]);
      setComptes(bord.accounts);
      setEvenements(bord.events);
      setChiffres(stats.stats);
    } catch (e: any) {
      setErreur(e?.message || 'Impossible de charger le tableau de bord.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const changer = async (compte: ComptePlateforme, patch: Partial<ComptePlateforme>) => {
    setEnCours(compte.email);
    setErreur(null);
    setSucces(null);

    try {
      const r = await modifierCompte(compte.email, {
        role: patch.role ?? compte.role,
        suspended: patch.suspended ?? compte.suspended,
      });

      setComptes(prev => prev.map(c => (c.email === r.account.email ? r.account : c)));
      setSucces(r.message);
      setTimeout(() => setSucces(null), 3000);
    } catch (e: any) {
      // Le serveur explique pourquoi il refuse — dernier administrateur,
      // rétrogradation de soi-même — et cette explication vaut mieux qu'un
      // « échec » générique.
      setErreur(e?.message || "Le changement n'a pas abouti.");
    } finally {
      setEnCours(null);
    }
  };

  const basculerValidation = async (compte: ComptePlateforme) => {
    setEnCours(compte.email);
    setErreur(null);
    setSucces(null);

    try {
      const r = await validerCompte(compte.email, !compte.validated);
      setComptes(prev => prev.map(c => (c.email === r.account.email ? r.account : c)));
      setSucces(r.message);
      setTimeout(() => setSucces(null), 3000);
    } catch (e: any) {
      setErreur(e?.message || "Le changement n'a pas abouti.");
    } finally {
      setEnCours(null);
    }
  };

  const depanner = async (compte: ComptePlateforme) => {
    setEnCours(compte.email);
    setErreur(null);
    setSucces(null);

    try {
      const r = await depannerMotDePasse(compte.email);
      setProvisoire({ email: compte.email, motDePasse: r.temporaryPassword });
      // Les sessions de cette personne sont tombees : l'etat affiche doit
      // refleter qu'elle devra changer de mot de passe.
      setComptes(prev =>
        prev.map(c => (c.email === compte.email ? { ...c, mustChangePassword: true } : c)),
      );
    } catch (e: any) {
      setErreur(e?.message || "Le dépannage n'a pas abouti.");
    } finally {
      setEnCours(null);
    }
  };

  const enAttente = comptes.filter(c => !c.validated && !c.suspended);

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={onRetour}
          className="text-sm font-bold text-stone-600 dark:text-stone-400 hover:text-emerald-700 cursor-pointer flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Mes événements
        </button>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-heading font-black text-2xl tracking-tight">Plateforme</h1>

          <button
            onClick={charger}
            disabled={chargement}
            className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            {chargement ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Actualiser
          </button>
        </div>

        {erreur && (
          <div className="mt-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 text-sm font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {erreur}
          </div>
        )}

        {provisoire && (
          <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Mot de passe provisoire pour {provisoire.email}
            </p>
            <p className="font-mono font-black text-2xl tracking-wider mt-2">
              {provisoire.motDePasse}
            </p>
            <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-2">
              Transmettez-le de vive voix. Il n’est affiché qu’une fois — le serveur ne le
              conserve pas en clair — et la personne devra en choisir un autre à sa prochaine
              connexion.
            </p>
            <button
              onClick={() => setProvisoire(null)}
              className="mt-3 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold cursor-pointer"
            >
              J’ai noté
            </button>
          </div>
        )}

        {succes && (
          <div className="mt-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {succes}
          </div>
        )}

        {chiffres && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <Chiffre
                libelle="Événements"
                valeur={`${chiffres.publies} / ${chiffres.evenements}`}
                icone={<CalendarDays className="w-3.5 h-3.5" />}
              />
              <Chiffre
                libelle="Organisateurs"
                valeur={chiffres.organisateurs}
                icone={<Users className="w-3.5 h-3.5" />}
              />
              <Chiffre
                libelle="Billets"
                valeur={`${chiffres.billetsUtilises} / ${chiffres.billets}`}
                icone={<Ticket className="w-3.5 h-3.5" />}
              />
              <Chiffre
                libelle="Commandes réglées"
                valeur={`${chiffres.commandesPayees} / ${chiffres.commandes}`}
              />
            </div>

            <div className="mt-3 text-xs text-stone-500">
              {/*
                * Seules les commandes réglées sont comptées : afficher aussi
                * celles en attente donnerait un montant qui n'a pas été
                * encaissé, et sur lequel personne ne devrait compter.
                */}
              {/*
                * Les devises sans recette sont écartées : `prix` dit
                * « Gratuit » pour un montant nul, ce qui est juste pour un
                * billet mais absurde pour une recette — zéro encaissé n'est
                * pas une recette gratuite.
                */}
              Encaissé :{' '}
              {(() => {
                const perçues = chiffres.recettes.filter(r => r.montant > 0);
                return perçues.length === 0
                  ? 'rien pour l’instant'
                  : perçues.map(r => prix(r.montant, r.devise)).join(' · ');
              })()}
            </div>
          </>
        )}

        {enAttente.length > 0 && (
          <>
            <h2 className="font-heading font-black text-lg mt-9 mb-1">
              En attente de validation ({enAttente.length})
            </h2>
            {/*
              * Mise en tete parce que c'est la seule chose qui attend quelqu'un :
              * tant qu'un compte n'est pas validé, son organisateur ne peut rien
              * publier, et il n'a aucun moyen de le savoir sinon en essayant.
              */}
            <p className="text-xs text-stone-500 mb-3">
              Ces comptes peuvent préparer un événement, pas le publier.
            </p>

            <div className="space-y-2">
              {enAttente.map(compte => (
                <div
                  key={compte.email}
                  className="border border-amber-300 dark:border-amber-900 bg-amber-500/5 rounded-2xl p-3 flex items-center gap-3 flex-wrap"
                >
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-bold text-sm">{compte.name}</p>
                    <p className="text-xs text-stone-500">{compte.email}</p>
                  </div>

                  <button
                    onClick={() => basculerValidation(compte)}
                    disabled={enCours === compte.email}
                    className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    {enCours === compte.email ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Valider
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="font-heading font-black text-lg mt-9 mb-3">Comptes</h2>

        <div className="space-y-2">
          {comptes.map(compte => (
            <div
              key={compte.email}
              className="border border-stone-200 dark:border-stone-800 rounded-2xl p-3 flex items-center gap-3 flex-wrap"
            >
              <div className="flex-1 min-w-[180px]">
                <p className="font-bold text-sm">{compte.name}</p>
                <p className="text-xs text-stone-500">{compte.email}</p>
                <p className="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className={compte.validated ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                    {compte.validated ? 'validé' : 'en attente'}
                  </span>
                  {compte.mustChangePassword && (
                    <span className="text-amber-700 dark:text-amber-400">mot de passe provisoire</span>
                  )}
                </p>
              </div>

              <button
                onClick={() => basculerValidation(compte)}
                disabled={enCours === compte.email}
                className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                {compte.validated ? 'Retirer la validation' : 'Valider'}
              </button>

              <button
                onClick={() => depanner(compte)}
                disabled={enCours === compte.email}
                title="Émet un mot de passe provisoire et ferme les sessions ouvertes de cette personne"
                className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" /> Dépanner
              </button>

              <select
                value={compte.role}
                disabled={enCours === compte.email}
                onChange={e => changer(compte, { role: e.target.value as ComptePlateforme['role'] })}
                className="px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-bold outline-none cursor-pointer disabled:opacity-40"
              >
                {ROLES.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => changer(compte, { suspended: !compte.suspended })}
                disabled={enCours === compte.email}
                className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer disabled:opacity-40 ${
                  compte.suspended
                    ? 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
                    : 'border-stone-300 dark:border-stone-700'
                }`}
              >
                {enCours === compte.email ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : compte.suspended ? (
                  'Suspendu'
                ) : (
                  'Suspendre'
                )}
              </button>
            </div>
          ))}

          {!chargement && comptes.length === 0 && (
            <p className="text-sm text-stone-500">Aucun compte.</p>
          )}
        </div>

        <h2 className="font-heading font-black text-lg mt-9 mb-3">
          Tous les événements ({evenements.length})
        </h2>

        <div className="space-y-2">
          {evenements.map(e => (
            <div
              key={e.slug}
              className="border border-stone-200 dark:border-stone-800 rounded-2xl p-3 flex items-center gap-3 flex-wrap"
            >
              <div
                className="w-2 h-10 rounded-full shrink-0"
                style={{ backgroundColor: e.primaryColor || '#047857' }}
              />
              <div className="flex-1 min-w-[180px]">
                <p className="font-bold text-sm">
                  {e.name} {e.edition}
                </p>
                <p className="text-xs text-stone-500">
                  {e.ownerEmail} · {e.status === 'published' ? 'publié' : e.status === 'draft' ? 'brouillon' : 'archivé'}
                </p>
              </div>
            </div>
          ))}

          {!chargement && evenements.length === 0 && (
            <p className="text-sm text-stone-500">Aucun événement.</p>
          )}
        </div>
      </div>
    </div>
  );
};
