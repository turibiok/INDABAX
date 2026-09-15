import React from 'react';

import { useEvent } from '../context/EventContext';

/**
 * Logo de l'événement.
 *
 * Celui que l'événement a déclaré dans sa configuration, sinon celui livré avec
 * l'application. Un événement qui n'en fournit qu'un seul le voit servir aux
 * deux thèmes : lui en imposer un second serait le priver de logo.
 *
 * Le logo livré existe en deux fichiers, pour une raison de fond : son texte et
 * le contour de son écusson sont noirs, et disparaîtraient sur le thème sombre.
 * La variante claire les rend blancs en conservant le vert, le jaune et le
 * rouge du drapeau.
 *
 * Le choix se fait en CSS plutôt qu'en JavaScript : les deux images sont
 * posées l'une sur l'autre et Tailwind n'en montre qu'une selon le thème. Le
 * logo est ainsi correct dès la première image peinte, sans attendre que le
 * thème soit connu du code.
 */

interface LogoProps {
  /** « ecusson » pour la pastille seule, « complet » pour le bloc avec texte. */
  variant?: 'ecusson' | 'complet';
  /** Hauteur en pixels. La largeur suit les proportions du fichier. */
  height?: number;
  className?: string;
  /** Texte de remplacement ; vide pour un logo purement décoratif. */
  alt?: string;
}

const FICHIERS = {
  ecusson: { sombre: '/indabax-ecusson.png', clair: '/indabax-ecusson-clair.png', ratio: 1 },
  complet: { sombre: '/indabax-logo.png', clair: '/indabax-logo-clair.png', ratio: 900 / 253 },
} as const;

export const Logo: React.FC<LogoProps> = ({
  variant = 'ecusson',
  height = 40,
  className = '',
  alt,
}) => {
  const { eventConfig, eventLabel } = useEvent();
  const branding = eventConfig.branding;

  const livre = FICHIERS[variant];

  // Un logo fourni par l'événement remplace les deux fichiers livrés. Sans
  // variante sombre déclarée, le même sert aux deux thèmes.
  const propre = (branding?.logoUrl || '').trim();
  const propreSombre = (branding?.logoDarkUrl || '').trim() || propre;

  const sourceClaire = propre || livre.sombre;
  const sourceSombre = propreSombre || livre.clair;

  // Les proportions du fichier livré ne valent que pour lui : un logo fourni
  // est simplement contenu dans la hauteur demandée.
  const width = propre ? Math.round(height * FICHIERS.complet.ratio) : Math.round(height * livre.ratio);
  const texte = alt ?? eventLabel;

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width, height }}
    >
      <img
        src={sourceClaire}
        alt={texte}
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full object-contain dark:hidden"
      />
      <img
        src={sourceSombre}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full object-contain hidden dark:block"
      />
    </span>
  );
};
