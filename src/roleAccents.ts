import { ParticipantRole, RoleAccent } from './types';
import { roleFor } from './permissions';

/**
 * Teintes des roles.
 *
 * Elles vivent ici, en liste fermee, plutot que d'etre saisies librement par
 * les organisateurs : une couleur libre produirait tot ou tard du texte noir
 * sur fond sombre, et rien ne le signalerait. Huit teintes suffisent a
 * distinguer les roles d'un evenement, et chacune est declinee pour les deux
 * themes.
 *
 * Les classes sont ecrites en toutes lettres parce que Tailwind les collecte
 * en lisant le code : une classe assemblee a l'execution ne serait pas
 * generee, et le badge sortirait sans couleur.
 */

interface JeuDeTeintes {
  /** Pastille pleine, pour les badges de role. */
  plein: string;
  /** Pastille discrete bordee, pour les listes et les tableaux. */
  discret: string;
  /** Fond d'onglet actif, dans le selecteur d'espace. */
  actif: string;
}

const TEINTES: Record<RoleAccent, JeuDeTeintes> = {
  rouge: {
    plein: 'bg-rose-600 text-white',
    discret:
      'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800',
    actif: 'bg-rose-600 text-white shadow-xs',
  },
  ambre: {
    plein: 'bg-amber-500 text-white',
    discret:
      'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    actif: 'bg-amber-500 text-stone-950 shadow-xs',
  },
  indigo: {
    plein: 'bg-indigo-600 text-white',
    discret:
      'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
    actif: 'bg-indigo-600 text-white shadow-xs',
  },
  emeraude: {
    plein: 'bg-emerald-600 text-white',
    discret:
      'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    actif: 'bg-emerald-600 text-white shadow-xs',
  },
  violet: {
    plein: 'bg-purple-600 text-white',
    discret:
      'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    actif: 'bg-purple-600 text-white shadow-xs',
  },
  ardoise: {
    plein: 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200',
    discret:
      'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700',
    actif: 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs',
  },
  ciel: {
    plein: 'bg-sky-700 text-white',
    discret:
      'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800',
    actif: 'bg-sky-700 text-white shadow-xs',
  },
  rose: {
    plein: 'bg-pink-600 text-white',
    discret:
      'bg-pink-100 dark:bg-pink-950/60 text-pink-800 dark:text-pink-300 border-pink-300 dark:border-pink-800',
    actif: 'bg-pink-600 text-white shadow-xs',
  },
};

/** Les huit teintes, pour l'ecran qui cree les roles. */
export const ACCENTS_DISPONIBLES = Object.keys(TEINTES) as RoleAccent[];

function teintesDe(accent: RoleAccent | undefined): JeuDeTeintes {
  return (accent && TEINTES[accent]) || TEINTES.ardoise;
}

/** Classes de la pastille pleine d'un role. */
export function classesPleines(role: ParticipantRole): string {
  return teintesDe(roleFor(role).accent).plein;
}

/** Classes de la pastille discrete d'un role. */
export function classesDiscretes(role: ParticipantRole): string {
  return teintesDe(roleFor(role).accent).discret;
}

/** Classes de l'onglet actif d'un role, dans le selecteur d'espace. */
export function classesActives(role: ParticipantRole): string {
  return teintesDe(roleFor(role).accent).actif;
}

/** Classes d'un accent designe directement, pour les apercus. */
export function classesPourAccent(accent: RoleAccent): JeuDeTeintes {
  return teintesDe(accent);
}
