import React from 'react';

import { ParticipantRole } from '../types';
import { capabilitiesFor } from '../permissions';
import { classesPleines } from '../roleAccents';

/**
 * Pastille du rôle d'une personne.
 *
 * Les annonces et les discussions traduisaient chacune les rôles de leur
 * côté, avec des listes incomplètes : un Super-Admin y apparaissait comme
 * « Membre », et un sponsor aussi. Le libellé comme la couleur viennent
 * désormais de la table des rôles de l'événement, qui est déjà la référence
 * côté serveur : un rôle créé là s'affiche correctement ici sans autre
 * intervention.
 */

interface RoleBadgeProps {
  role: ParticipantRole;
  /** Pastille réduite, pour les fils de discussion serrés. */
  compact?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, compact = false }) => {
  const label = capabilitiesFor(role).label;
  const size = compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';

  return (
    <span className={`rounded font-bold uppercase tracking-wider shrink-0 ${size} ${classesPleines(role)}`}>
      {label}
    </span>
  );
};
