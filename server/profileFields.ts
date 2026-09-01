import { UserAccount } from '../src/types';
import { getSheetsConfig } from './store';
import { SheetError, writeRows } from './sheetsGateway';

/**
 * Champs de profil que chacun renseigne pour lui-même.
 *
 * Ce que cette liste ne contient pas est aussi important que ce qu'elle
 * contient : ni le rôle, ni le statut, ni l'empreinte du mot de passe, ni
 * l'email. Une personne qui pourrait modifier son propre rôle n'aurait plus
 * besoin d'organisateur pour devenir administrateur, et l'email est la clé qui
 * identifie sa ligne dans le classeur.
 */

/** Longueurs maximales. Une cellule Google Sheets casse bien au-delà. */
const LIMITES: Record<string, number> = {
  name: 120,
  institution: 160,
  position: 120,
  country: 80,
  city: 80,
  phone: 40,
  linkedin: 200,
  website: 200,
  bio: 1200,
  interests: 400,
};

/** Colonne du classeur pour chaque champ. */
const COLONNES: Record<string, string> = {
  name: 'Nom',
  institution: 'Institution',
  position: 'Poste',
  country: 'Pays',
  city: 'Ville',
  phone: 'Telephone',
  linkedin: 'LinkedIn',
  website: 'Site web',
  bio: 'Bio',
  interests: 'Interets',
};

export type ChampProfil = keyof typeof COLONNES;

export interface ProfilePatch {
  name?: string;
  institution?: string;
  position?: string;
  country?: string;
  city?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  bio?: string;
  interests?: string[];
}

export interface ProfileCheck {
  patch?: ProfilePatch;
  error?: string;
  reason?: string;
}

/** Découpe une liste saisie à la main, quel que soit le séparateur choisi. */
function decouper(valeur: string): string[] {
  return valeur
    .split(/[;,|\n]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Vérifie et met en forme ce qui arrive du client.
 *
 * Un champ absent du corps de la requête n'est pas touché ; un champ présent
 * mais vide efface la valeur. C'est ce qui permet de retirer un numéro de
 * téléphone sans avoir à tout ressaisir.
 */
export function checkProfile(body: unknown): ProfileCheck {
  if (!body || typeof body !== 'object') {
    return { error: 'Aucune information reçue.', reason: 'empty' };
  }

  const brut = body as Record<string, unknown>;
  const patch: ProfilePatch = {};

  for (const champ of Object.keys(COLONNES) as ChampProfil[]) {
    if (!(champ in brut)) continue;

    const valeur = brut[champ];

    if (champ === 'interests') {
      const liste = Array.isArray(valeur)
        ? valeur.map(item => String(item).trim()).filter(Boolean).slice(0, 20)
        : decouper(String(valeur ?? ''));

      const total = liste.join('; ').length;
      if (total > LIMITES.interests) {
        return {
          error: `Les centres d'intérêt dépassent ${LIMITES.interests} caractères.`,
          reason: 'too_long',
        };
      }
      patch.interests = liste;
      continue;
    }

    if (typeof valeur !== 'string' && valeur !== null && valeur !== undefined) {
      return { error: `Le champ « ${champ} » doit être du texte.`, reason: 'bad_type' };
    }

    const texte = String(valeur ?? '').trim().replace(/\s+/g, ' ');

    if (texte.length > LIMITES[champ]) {
      return {
        error: `Le champ « ${COLONNES[champ]} » dépasse ${LIMITES[champ]} caractères.`,
        reason: 'too_long',
      };
    }

    (patch as Record<string, string>)[champ] = texte;
  }

  if (Object.keys(patch).length === 0) {
    return { error: 'Aucune information à enregistrer.', reason: 'empty' };
  }

  // Le nom sert d'identité affichée partout : le laisser vide rendrait des
  // messages signés par personne.
  if (patch.name !== undefined && patch.name === '') {
    return { error: 'Le nom ne peut pas être vide.', reason: 'name_required' };
  }

  return { patch };
}

/** Applique le patch à un compte, sans toucher au reste. */
export function appliquerPatch(compte: UserAccount, patch: ProfilePatch): UserAccount {
  return {
    ...compte,
    name: patch.name ?? compte.name,
    institution: patch.institution ?? compte.institution,
    position: patch.position ?? compte.position,
    country: patch.country ?? compte.country,
    city: patch.city ?? compte.city,
    phone: patch.phone ?? compte.phone,
    linkedin: patch.linkedin ?? compte.linkedin,
    website: patch.website ?? compte.website,
    bio: patch.bio ?? compte.bio,
    interests: patch.interests ?? compte.interests,
  };
}

/**
 * Écrit le profil dans le classeur.
 *
 * Comme pour la photo et l'empreinte, un échec n'annule pas la modification :
 * elle vaut pour la session en cours, et ce qui manque est sa survie au
 * redémarrage. La raison est renvoyée pour être dite à la personne plutôt que
 * tue.
 */
export async function saveProfileInSheet(
  email: string,
  patch: ProfilePatch,
): Promise<{ written: boolean; warning?: string }> {
  const config = getSheetsConfig();

  if (!config.isLinked) return { written: false };

  if (!config.writeWebhookUrl.trim()) {
    return {
      written: false,
      warning:
        "Aucun Apps Script n'est configuré : vos informations s'affichent, mais elles seront à " +
        'ressaisir si le serveur redémarre.',
    };
  }

  const ligne: Record<string, unknown> = { Email: email };

  for (const [champ, colonne] of Object.entries(COLONNES)) {
    const valeur = (patch as Record<string, unknown>)[champ];
    if (valeur === undefined) continue;
    ligne[colonne] = Array.isArray(valeur) ? valeur.join('; ') : valeur;
  }

  try {
    await writeRows(config.profilesTab, [ligne], { keyColumn: 'Email' });
    return { written: true };
  } catch (error: any) {
    const detail = error instanceof SheetError ? error.message : String(error?.message || error);
    console.warn(`Profil non enregistré dans le classeur pour ${email} : ${detail}`);

    return {
      written: false,
      warning: 'Vos informations s’affichent, mais le classeur n’a pas pu être mis à jour.',
    };
  }
}
