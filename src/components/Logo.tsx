import React from 'react';

/**
 * Logo officiel IndabaX Bénin.
 *
 * Deux fichiers, et une raison de fond : le texte « Deep Learning IndabaX » et
 * le contour de l'écusson sont noirs. Sur le thème sombre de l'application,
 * ils disparaîtraient. La variante claire les rend blancs, en conservant le
 * vert, le jaune et le rouge du drapeau.
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
  alt = 'IndabaX Bénin',
}) => {
  const fichier = FICHIERS[variant];
  const width = Math.round(height * fichier.ratio);

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width, height }}
    >
      <img
        src={fichier.sombre}
        alt={alt}
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full object-contain dark:hidden"
      />
      <img
        src={fichier.clair}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full object-contain hidden dark:block"
      />
    </span>
  );
};
