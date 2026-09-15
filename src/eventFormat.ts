/**
 * Mise en forme des dates de l'evenement.
 *
 * L'application affichait « 2026-09-18 → 2026-09-20 » a ses visiteurs : une
 * date de base de donnees, pas une date qu'on lit. Et comme les dates sont
 * desormais saisies par les organisateurs, elles peuvent etre vides ou
 * incompletes, ce dont il faut s'accommoder sans afficher « Invalid Date ».
 */

const JOURS_MOIS = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const JOURS_MOIS_AN = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function enDate(valeur: string): Date | null {
  const brut = (valeur || '').trim();
  if (!brut) return null;

  const date = new Date(brut);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Periode de l'evenement, en francais.
 *
 * « 18 – 20 septembre 2026 » quand le mois est le meme, « 30 septembre –
 * 2 octobre 2026 » sinon, et la seule date connue quand il n'y en a qu'une.
 * Rien du tout si aucune n'est renseignee : mieux vaut une barre sans dates
 * qu'une barre qui affiche un tiret solitaire.
 */
export function periodeEvenement(debut: string, fin: string): string {
  const d = enDate(debut);
  const f = enDate(fin);

  if (!d && !f) return '';
  if (d && !f) return JOURS_MOIS_AN.format(d);
  if (!d && f) return JOURS_MOIS_AN.format(f as Date);

  const debutDate = d as Date;
  const finDate = f as Date;

  if (debutDate.getTime() === finDate.getTime()) return JOURS_MOIS_AN.format(debutDate);

  const memeAnnee = debutDate.getFullYear() === finDate.getFullYear();
  const memeMois = memeAnnee && debutDate.getMonth() === finDate.getMonth();

  if (memeMois) {
    return `${debutDate.getDate()} – ${JOURS_MOIS_AN.format(finDate)}`;
  }

  if (memeAnnee) {
    return `${JOURS_MOIS.format(debutDate)} – ${JOURS_MOIS_AN.format(finDate)}`;
  }

  return `${JOURS_MOIS_AN.format(debutDate)} – ${JOURS_MOIS_AN.format(finDate)}`;
}

/** Assemble les fragments non vides d'une ligne de presentation. */
export function ligneEvenement(...fragments: string[]): string {
  return fragments.map(f => (f || '').trim()).filter(Boolean).join(' • ');
}

/**
 * Prefixe des numeros de billet.
 *
 * Celui que l'evenement a choisi s'il en a un, sinon les initiales du nom
 * suivies de l'edition : « Hackathon Cotonou » 2027 donne « HC-2027 ». Les
 * initiales plutot que le nom entier parce qu'un numero de billet se recopie a
 * la main dans le champ de recherche du scanner.
 */
export function prefixeBillet(nom: string, edition: string, choisi: string): string {
  const explicite = (choisi || '').trim();
  if (explicite) return explicite;

  const initiales = (nom || '')
    .split(/\s+/)
    .map(mot => mot.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .map(mot => mot[0].toUpperCase())
    .join('');

  const base = initiales || 'EVT';
  const suffixe = (edition || '').trim().replace(/\s+/g, '-');

  return suffixe ? `${base}-${suffixe}` : base;
}
