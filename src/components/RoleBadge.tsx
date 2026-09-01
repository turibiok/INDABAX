import React from 'react';

import { ParticipantRole } from '../types';
import { capabilitiesFor } from '../permissions';

/**
 * Pastille du rôle d'une personne.
 *
 * Les annonces et les discussions traduisaient chacune les rôles de leur
 * côté, avec des listes incomplètes : un Super-Admin y apparaissait comme
 * « Membre », et un sponsor aussi. Le libellé vient désormais de
 * `ROLE_CAPABILITIES`, qui est déjà la référence côté serveur : un rôle
 * ajouté là se nomme correctement ici sans autre intervention.
 */

const COLORS: Record<ParticipantRole, string> = {
  'super-admin': 'bg-rose-600 text-white',
  organizer: 'bg-amber-500 text-white',
  speaker: 'bg-indigo-600 text-white',
  volunteer: 'bg-emerald-600 text-white',
  sponsor: 'bg-sky-700 text-white',
  attendee: 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200',
};

interface RoleBadgeProps {
  role: ParticipantRole;
  /** Pastille réduite, pour les fils de discussion serrés. */
  compact?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, compact = false }) => {
  const label = capabilitiesFor(role).label;
  const size = compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';

  return (
    <span className={`rounded font-bold uppercase tracking-wider shrink-0 ${size} ${COLORS[role]}`}>
      {label}
    </span>
  );
};
