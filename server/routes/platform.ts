import { Router } from 'express';

import {
  composerCompte,
  comptePlateforme,
  motDePasseProvisoire,
  enregistrerCompte,
  enregistrerEvenement,
  EventRecord,
  evenementParSlug,
  evenementsDe,
  evenementsPublics,
  PlatformAccount,
  PlatformRole,
  registreConfigure,
  slugDisponible,
  statistiques,
  tousLesComptes,
  tousLesEvenements,
  versSlug,
} from '../platform';
import {
  AuthedRequest,
  createSession,
  requireAuth,
  revokeSessionsForEmail,
  setSessionCookie,
  toClientSession,
} from '../sessions';
import { DbError } from '../db';
import { hashPassword, verifyPassword } from '../passwords';

/**
 * La plateforme Tech Event : les evenements et les comptes qui les portent.
 *
 * Deux niveaux de droits cohabitent, et les confondre serait une faute :
 *
 * - le role DE PLATEFORME dit si l'on peut creer un evenement ;
 * - le role DANS UN EVENEMENT dit ce qu'on y fait une fois entre.
 *
 * Quelqu'un peut organiser le sien et n'etre que participant a celui du
 * voisin. C'est pourquoi les deux vivent dans des tables separees, et que ce
 * fichier ne touche jamais aux roles d'evenement.
 */
export const platformRouter = Router();

function repondreErreur(res: any, error: unknown) {
  if (error instanceof DbError) {
    return res.status(error.status).json({ error: error.message, reason: error.reason });
  }
  const message = error instanceof Error ? error.message : String(error);
  return res.status(500).json({ error: message });
}

/**
 * Ce qu'un evenement montre au public.
 *
 * Ni le lien du classeur ni celui du script n'en font partie : les connaitre
 * suffirait a lire l'annuaire complet des inscrits, puisque le classeur est
 * partage « a toute personne disposant du lien ».
 */
function versVitrine(e: EventRecord) {
  return {
    slug: e.slug,
    name: e.name,
    edition: e.edition,
    startDate: e.startDate,
    endDate: e.endDate,
    location: e.location,
    summary: e.summary,
    logoUrl: e.logoUrl,
    posterUrl: e.posterUrl,
    primaryColor: e.primaryColor,
    status: e.status,
  };
}

/** Vue complete, reservee a qui repond de l'evenement. */
function versGestion(e: EventRecord) {
  return { ...versVitrine(e), ownerEmail: e.ownerEmail, sheetUrl: e.sheetUrl, appsScriptUrl: e.appsScriptUrl, createdAt: e.createdAt, updatedAt: e.updatedAt };
}

/** Le compte, sans jamais son empreinte. */
/** Le compte, sans jamais son empreinte. */
function versPublic(c: PlatformAccount) {
  return {
    email: c.email,
    name: c.name,
    role: c.role,
    suspended: Boolean(c.suspended),
    validated: Boolean(c.validated),
    validatedBy: c.validatedBy,
    validatedAt: c.validatedAt,
    mustChangePassword: Boolean(c.mustChangePassword),
  };
}

/* ------------------------------------------------------------------ *
 * Vitrine
 * ------------------------------------------------------------------ */

/** Les evenements publies. Lisible sans connexion : c'est la vitrine. */
platformRouter.get('/events', async (_req, res) => {
  if (!registreConfigure()) {
    return res.json({ configured: false, events: [] });
  }

  try {
    const evenements = await evenementsPublics();
    res.json({ configured: true, events: evenements.map(versVitrine) });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/** Un evenement publie, par son identifiant d'URL. */
platformRouter.get('/events/:slug', async (req, res) => {
  try {
    const evenement = await evenementParSlug(req.params.slug);

    if (!evenement || evenement.status !== 'published') {
      return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
    }

    res.json({ event: versVitrine(evenement) });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/* ------------------------------------------------------------------ *
 * Mes evenements
 * ------------------------------------------------------------------ */

/**
 * Ce que la personne connectee peut administrer.
 *
 * Un administrateur de plateforme voit tout ; un organisateur ne voit que les
 * siens. Le filtrage se fait ici, cote serveur, et non en cachant des lignes
 * dans le navigateur.
 */
platformRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const email = (req.session?.email || '').toLowerCase();

  try {
    const compte = await comptePlateforme(email);
    const estAdmin = compte?.role === 'admin';
    const evenements = estAdmin ? await tousLesEvenements() : await evenementsDe(email);

    res.json({
      account: compte ? versPublic(compte) : { email, name: email, role: 'member', suspended: false },
      events: evenements.map(versGestion),
      canCreate: compte?.role === 'admin' || compte?.role === 'organizer',
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/* ------------------------------------------------------------------ *
 * Creation et modification
 * ------------------------------------------------------------------ */

interface CorpsEvenement {
  name?: string;
  edition?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  summary?: string;
  sheetUrl?: string;
  appsScriptUrl?: string;
  logoUrl?: string;
  posterUrl?: string;
  primaryColor?: string;
  status?: string;
}

/** Ce qu'un evenement doit porter pour etre inscrit au registre. */
function valider(corps: CorpsEvenement): string[] {
  const manques: string[] = [];

  if (!(corps.name || '').trim()) manques.push('un nom');
  if (!(corps.startDate || '').trim()) manques.push('une date de début');
  if (!(corps.endDate || '').trim()) manques.push('une date de fin');

  const debut = (corps.startDate || '').trim();
  const fin = (corps.endDate || '').trim();
  if (debut && fin && fin < debut) manques.push('une date de fin postérieure au début');

  return manques;
}

platformRouter.post('/events', requireAuth, async (req: AuthedRequest, res) => {
  const email = (req.session?.email || '').toLowerCase();
  const compte = await comptePlateforme(email);

  if (!compte || compte.suspended || (compte.role !== 'admin' && compte.role !== 'organizer')) {
    return res.status(403).json({
      error: "Votre compte ne permet pas de créer un événement.",
      reason: 'forbidden',
    });
  }

  /*
   * Un compte non valide prepare son evenement mais ne le publie pas. Le
   * refuser ici plutot qu'a la publication lui eviterait de tout saisir pour
   * rien ; l'inverse — laisser creer et bloquer a la publication — permet au
   * contraire de travailler pendant que la validation arrive. C'est ce second
   * choix qui est retenu, et la restriction porte donc sur le statut.
   */

  const corps = (req.body || {}) as CorpsEvenement;
  const manques = valider(corps);

  if (manques.length > 0) {
    return res.status(400).json({
      error: `Il manque ${manques.join(', ')}.`,
      reason: 'incomplete',
    });
  }

  const maintenant = new Date().toISOString();

  const evenement: EventRecord = {
    slug: await slugDisponible(corps.name || '', corps.edition || ''),
    name: (corps.name || '').trim(),
    edition: (corps.edition || '').trim(),
    startDate: (corps.startDate || '').trim(),
    endDate: (corps.endDate || '').trim(),
    location: (corps.location || '').trim(),
    summary: (corps.summary || '').trim(),
    ownerEmail: email,
    // Un evenement nait en brouillon : le publier est un geste separe, pour
    // qu'une saisie a moitie faite n'apparaisse pas sur la vitrine.
    status: 'draft',
    sheetUrl: (corps.sheetUrl || '').trim(),
    appsScriptUrl: (corps.appsScriptUrl || '').trim(),
    logoUrl: (corps.logoUrl || '').trim(),
    posterUrl: (corps.posterUrl || '').trim(),
    primaryColor: (corps.primaryColor || '').trim() || '#047857',
    createdAt: maintenant,
    updatedAt: maintenant,
  };

  try {
    const enregistre = await enregistrerEvenement(evenement);
    res.status(201).json({ event: versGestion(enregistre), message: 'Événement créé.' });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/** Modifie un evenement dont on repond. */
platformRouter.put('/events/:slug', requireAuth, async (req: AuthedRequest, res) => {
  const email = (req.session?.email || '').toLowerCase();
  const compte = await comptePlateforme(email);
  const existant = await evenementParSlug(req.params.slug);

  if (!existant) {
    return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
  }

  /*
   * Le meme refus, qu'on ne soit pas proprietaire ou que l'evenement n'existe
   * pas : distinguer les deux dirait a un curieux quels identifiants existent.
   */
  const autorise = compte?.role === 'admin' || existant.ownerEmail === email;
  if (!autorise || compte?.suspended) {
    return res.status(404).json({ error: 'Événement introuvable.', reason: 'not_found' });
  }

  const corps = (req.body || {}) as CorpsEvenement;
  const manques = valider({ ...existant, ...corps });

  if (manques.length > 0) {
    return res.status(400).json({ error: `Il manque ${manques.join(', ')}.`, reason: 'incomplete' });
  }

  const statut = (corps.status || '').trim();
  const statutValide = ['draft', 'published', 'archived'].includes(statut);

  /*
   * La publication demande un compte valide. Un administrateur en est
   * dispense : c'est lui qui valide, et le lui interdire enfermerait la
   * plateforme le jour ou le premier compte n'a encore ete valide par
   * personne.
   */
  if (statut === 'published' && compte?.role !== 'admin' && !compte?.validated) {
    return res.status(403).json({
      error:
        "Votre compte n'est pas encore validé : vous pouvez préparer l'événement, " +
        'mais sa publication attend l’accord d’un administrateur.',
      reason: 'not_validated',
    });
  }

  const modifie: EventRecord = {
    ...existant,
    name: corps.name !== undefined ? corps.name.trim() : existant.name,
    edition: corps.edition !== undefined ? corps.edition.trim() : existant.edition,
    startDate: corps.startDate !== undefined ? corps.startDate.trim() : existant.startDate,
    endDate: corps.endDate !== undefined ? corps.endDate.trim() : existant.endDate,
    location: corps.location !== undefined ? corps.location.trim() : existant.location,
    summary: corps.summary !== undefined ? corps.summary.trim() : existant.summary,
    sheetUrl: corps.sheetUrl !== undefined ? corps.sheetUrl.trim() : existant.sheetUrl,
    appsScriptUrl:
      corps.appsScriptUrl !== undefined ? corps.appsScriptUrl.trim() : existant.appsScriptUrl,
    logoUrl: corps.logoUrl !== undefined ? corps.logoUrl.trim() : existant.logoUrl,
    posterUrl: corps.posterUrl !== undefined ? corps.posterUrl.trim() : existant.posterUrl,
    primaryColor:
      corps.primaryColor !== undefined ? corps.primaryColor.trim() || '#047857' : existant.primaryColor,
    status: statutValide ? (statut as EventRecord['status']) : existant.status,
    // Le proprietaire ne se transmet pas par ce formulaire : sinon n'importe
    // quel organisateur pourrait s'attribuer l'evenement d'un autre.
    ownerEmail: existant.ownerEmail,
  };

  try {
    const enregistre = await enregistrerEvenement(modifie);
    res.json({ event: versGestion(enregistre), message: 'Événement enregistré.' });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/* ------------------------------------------------------------------ *
 * Comptes
 * ------------------------------------------------------------------ */

/**
 * Inscription d'un organisateur.
 *
 * Ouverte, conformement au choix fait pour la plateforme. Deux precautions :
 * un compte nait « organisateur » et non « administrateur », et la reponse ne
 * dit jamais si une adresse est deja prise — sans quoi cette route servirait a
 * enumerer les comptes existants.
 */
platformRouter.post('/register', async (req, res) => {
  const corps = req.body || {};
  const email = String(corps.email || '').trim().toLowerCase();
  const nom = String(corps.name || '').trim();
  const motDePasse = String(corps.password || '');

  if (!email.includes('@') || motDePasse.length < 8) {
    return res.status(400).json({
      error: 'Une adresse email valide et un mot de passe de 8 caractères au moins sont requis.',
      reason: 'bad_input',
    });
  }

  const neutre = {
    ok: true,
    message:
      'Si cette adresse peut être utilisée, le compte est créé. Connectez-vous pour continuer.',
  };

  if (await comptePlateforme(email)) return res.json(neutre);

  try {
    await enregistrerCompte(composerCompte({
      email,
      name: nom || email.split('@')[0],
      role: 'organizer',
      passwordHash: await hashPassword(motDePasse),
      createdAt: new Date().toISOString(),
      suspended: false,
    }));

    res.json(neutre);
  } catch (error) {
    repondreErreur(res, error);
  }
});

/** Connexion a la plateforme, distincte de celle d'un evenement. */
platformRouter.post('/login', async (req, res) => {
  const corps = req.body || {};
  const email = String(corps.email || '').trim().toLowerCase();
  const motDePasse = String(corps.password || '');

  const compte = await comptePlateforme(email);
  const refus = { error: 'Adresse ou mot de passe incorrect.', reason: 'bad_credentials' };

  /*
   * Le meme refus dans tous les cas — compte absent, sans empreinte, suspendu,
   * ou mauvais mot de passe. Les distinguer apprendrait quelles adresses sont
   * inscrites.
   */
  if (!compte || !compte.passwordHash || compte.suspended) {
    return res.status(401).json(refus);
  }

  const bon = await verifyPassword(motDePasse, compte.passwordHash);
  if (!bon) return res.status(401).json(refus);

  /*
   * La session est ouverte ici, et pas seulement le mot de passe verifie :
   * sans cela, la connexion reussissait sans donner acces a quoi que ce soit.
   *
   * Le role porte dans la session est celui de l'evenement — « attendee » —
   * et non celui de la plateforme. Les deux ne se confondent pas : etre
   * administrateur de la plateforme ne donne aucun droit dans l'evenement de
   * quelqu'un d'autre, et les routes de plateforme relisent le role reel a
   * chaque appel.
   */
  const session = await createSession({
    email: compte.email,
    name: compte.name,
    role: 'attendee',
    status: 'active',
    source: 'platform',
  });

  setSessionCookie(res, session);

  res.json({
    account: versPublic(compte),
    session: toClientSession(session),
    // Dit a l'interface d'exiger un nouveau mot de passe avant tout le reste.
    mustChangePassword: compte.mustChangePassword,
  });
});

/* ------------------------------------------------------------------ *
 * Administration
 * ------------------------------------------------------------------ */

/** Liste des comptes et de tous les evenements. Reserve aux administrateurs. */
platformRouter.get('/admin', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const compte = await comptePlateforme((req.session?.email || '').toLowerCase());

    if (compte?.role !== 'admin') {
      return res.status(403).json({ error: 'Réservé aux administrateurs.', reason: 'forbidden' });
    }

    res.json({
      accounts: (await tousLesComptes()).map(versPublic),
      events: (await tousLesEvenements()).map(versGestion),
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/** Chiffres de la plateforme, pour le tableau de bord. */
platformRouter.get('/admin/stats', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const compte = await comptePlateforme((req.session?.email || '').toLowerCase());
    if (compte?.role !== 'admin') {
      return res.status(403).json({ error: 'Réservé aux administrateurs.', reason: 'forbidden' });
    }

    res.json({ stats: await statistiques() });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/**
 * Change le role ou la suspension d'un compte.
 *
 * Deux refus, et le second compte plus que le premier : on ne se retire pas
 * son propre role d'administrateur, et on ne retire pas le dernier. Sans cela,
 * la plateforme se retrouverait sans personne pour la corriger — le meme piege
 * que la table des roles d'un evenement.
 */
platformRouter.put('/admin/accounts/:email', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const moi = (req.session?.email || '').toLowerCase();
    const compte = await comptePlateforme(moi);

    if (compte?.role !== 'admin') {
      return res.status(403).json({ error: 'Réservé aux administrateurs.', reason: 'forbidden' });
    }

    const cible = await comptePlateforme(req.params.email);
    if (!cible) {
      return res.status(404).json({ error: 'Compte introuvable.', reason: 'not_found' });
    }

    const corps = req.body || {};
    const role = String(corps.role || cible.role);
    const suspendu = corps.suspended === undefined ? cible.suspended : Boolean(corps.suspended);

    if (!['admin', 'organizer', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Rôle inconnu.', reason: 'bad_input' });
    }

    if (cible.email === moi && (role !== 'admin' || suspendu)) {
      return res.status(409).json({
        error: "Vous ne pouvez pas retirer vos propres droits : demandez-le à un autre administrateur.",
        reason: 'self_demotion',
      });
    }

    if (cible.role === 'admin' && (role !== 'admin' || suspendu)) {
      const restants = (await tousLesComptes()).filter(
        c => c.role === 'admin' && !c.suspended && c.email !== cible.email,
      );

      if (restants.length === 0) {
        return res.status(409).json({
          error:
            "C'est le dernier administrateur actif : le rétrograder laisserait la plateforme sans personne pour la corriger.",
          reason: 'last_admin',
        });
      }
    }

    const enregistre = await enregistrerCompte(composerCompte({
      ...cible,
      role: role as PlatformRole,
      suspended: suspendu,
    }));

    res.json({ account: versPublic(enregistre), message: 'Compte mis à jour.' });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/* ------------------------------------------------------------------ *
 * Validation des comptes
 * ------------------------------------------------------------------ */

/**
 * Valide ou retire la validation d'un compte.
 *
 * L'inscription est ouverte, mais publier sous le nom de la plateforme ne
 * l'est pas : un compte non valide se connecte et prepare son evenement, sans
 * pouvoir le publier. Qui a valide et quand sont conserves — une decision
 * d'acces sans trace est une decision que personne ne saura expliquer plus
 * tard.
 */
platformRouter.put('/admin/accounts/:email/validation', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const moi = (req.session?.email || '').toLowerCase();
    const administrateur = await comptePlateforme(moi);

    if (administrateur?.role !== 'admin') {
      return res.status(403).json({ error: 'Réservé aux administrateurs.', reason: 'forbidden' });
    }

    const cible = await comptePlateforme(req.params.email);
    if (!cible) {
      return res.status(404).json({ error: 'Compte introuvable.', reason: 'not_found' });
    }

    const valide = (req.body || {}).validated !== false;

    const enregistre = await enregistrerCompte({
      ...cible,
      validated: valide,
      validatedBy: valide ? moi : undefined,
      validatedAt: valide ? new Date().toISOString() : undefined,
    });

    res.json({
      account: versPublic(enregistre),
      message: valide ? 'Compte validé.' : 'Validation retirée.',
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/* ------------------------------------------------------------------ *
 * Mots de passe
 * ------------------------------------------------------------------ */

/**
 * Chacun change le sien.
 *
 * L'ancien mot de passe est exige meme si la session est valable : un poste
 * laisse ouvert ne doit pas suffire a s'approprier le compte definitivement.
 */
platformRouter.put('/password', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const email = (req.session?.email || '').toLowerCase();
    const cible = await comptePlateforme(email);

    if (!cible) {
      return res.status(404).json({ error: 'Compte introuvable.', reason: 'not_found' });
    }

    const corps = req.body || {};
    const ancien = String(corps.currentPassword || '');
    const nouveau = String(corps.newPassword || '');

    if (nouveau.length < 8) {
      return res.status(400).json({
        error: 'Le nouveau mot de passe doit faire 8 caractères au moins.',
        reason: 'too_short',
      });
    }

    /*
     * Un mot de passe provisoire se remplace sans connaitre l'ancien : la
     * personne vient justement de le recevoir d'un administrateur, et
     * l'exiger reviendrait a lui demander de retaper ce qu'on vient de lui
     * dicter.
     */
    if (!cible.mustChangePassword) {
      if (!cible.passwordHash || !(await verifyPassword(ancien, cible.passwordHash))) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect.', reason: 'bad_password' });
      }
    }

    if (nouveau === ancien) {
      return res.status(400).json({
        error: 'Le nouveau mot de passe doit différer de l’ancien.',
        reason: 'unchanged',
      });
    }

    await enregistrerCompte({
      ...cible,
      passwordHash: await hashPassword(nouveau),
      mustChangePassword: false,
    });

    res.json({ ok: true, message: 'Mot de passe changé.' });
  } catch (error) {
    repondreErreur(res, error);
  }
});

/**
 * Un administrateur depanne quelqu'un.
 *
 * Le mot de passe est engendre par le serveur et montre une seule fois : ainsi
 * l'administrateur ne choisit pas — donc ne devine pas — le mot de passe de
 * quelqu'un, et le compte devra en prendre un autre a la connexion suivante.
 * Il ne connait donc jamais le mot de passe durable d'un tiers.
 */
platformRouter.post('/admin/accounts/:email/password', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const moi = (req.session?.email || '').toLowerCase();
    const administrateur = await comptePlateforme(moi);

    if (administrateur?.role !== 'admin') {
      return res.status(403).json({ error: 'Réservé aux administrateurs.', reason: 'forbidden' });
    }

    const cible = await comptePlateforme(req.params.email);
    if (!cible) {
      return res.status(404).json({ error: 'Compte introuvable.', reason: 'not_found' });
    }

    const provisoire = motDePasseProvisoire();

    await enregistrerCompte({
      ...cible,
      passwordHash: await hashPassword(provisoire),
      mustChangePassword: true,
    });

    // Les sessions ouvertes de cette personne tombent : un mot de passe remis
    // a zero doit interrompre un acces en cours, pas seulement le suivant.
    await revokeSessionsForEmail(cible.email);

    res.json({
      temporaryPassword: provisoire,
      message:
        'Mot de passe provisoire créé. Transmettez-le de vive voix : il n’est affiché qu’une fois, ' +
        'et la personne devra en choisir un autre.',
    });
  } catch (error) {
    repondreErreur(res, error);
  }
});

export { versSlug };
