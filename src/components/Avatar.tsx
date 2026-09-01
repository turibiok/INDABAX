import React from 'react';

/**
 * Avatar d'une personne, avec repli sur ses initiales.
 *
 * Les annonces et les messages viennent du classeur, qui ne contient aucune
 * photo : afficher une balise `img` sans source y montrerait une icône
 * d'image cassée à côté de chaque nom. Les initiales sur un fond de couleur
 * stable donnent un repère visuel utilisable, et sans requête sortante.
 */

interface AvatarProps {
  name: string;
  /** Sert à choisir la couleur : deux personnes homonymes restent distinctes. */
  seed?: string;
  url?: string;
  /** Taille en pixels. Les classes Tailwind ne prennent pas de valeur calculée. */
  size?: number;
  className?: string;
}

/** Palette assez contrastée pour porter du texte blanc. */
const COLORS = [
  '#0f766e',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#1d4ed8',
  '#047857',
  '#c2410c',
  '#4338ca',
];

function initialsOf(name: string): string {
  const words = (name || '')
    .trim()
    .split(/\s+/)
    .filter(word => /\p{L}/u.test(word));

  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Somme stable : la même personne garde sa couleur d'une session à l'autre. */
function colorOf(seed: string): string {
  let total = 0;
  for (let index = 0; index < seed.length; index++) {
    total = (total + seed.charCodeAt(index) * (index + 1)) % 100003;
  }
  return COLORS[total % COLORS.length];
}

export const Avatar: React.FC<AvatarProps> = ({ name, seed, url, size = 40, className = '' }) => {
  const [failed, setFailed] = React.useState(false);
  const dimension = { width: size, height: size };

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        style={dimension}
        onError={() => setFailed(true)}
        className={`rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      aria-label={name}
      title={name}
      style={{
        ...dimension,
        backgroundColor: colorOf(seed || name || '?'),
        fontSize: Math.max(10, Math.round(size * 0.38)),
      }}
      className={`rounded-full shrink-0 inline-flex items-center justify-center font-bold text-white select-none ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
};
