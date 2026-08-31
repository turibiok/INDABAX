/**
 * Modèles des feuilles du classeur Google Sheet.
 *
 * Ces tables décrivent exactement ce que le serveur sait lire et écrire : un
 * onglet par usage, avec des exemples cohérents entre eux (les mêmes emails et les mêmes
 * identifiants de session se retrouvent d'une feuille à l'autre).
 *
 * Les en-têtes sont tolérants : la lecture normalise accents, majuscules et
 * séparateurs, et accepte plusieurs libellés pour une même colonne. Seules les
 * colonnes marquées comme requises sont indispensables.
 */

export interface SheetTemplate {
  /** Nom de l'onglet attendu par défaut. */
  tab: string;
  /** À quoi sert cette feuille, en une phrase. */
  purpose: string;
  /** Sens de circulation des données. */
  direction: 'lecture' | 'écriture' | 'lecture-écriture';
  headers: string[];
  rows: string[][];
  /** Colonnes sans lesquelles la feuille est inexploitable. */
  requiredColumns: string[];
  /** Libellés alternatifs acceptés, par colonne. */
  aliases: Record<string, string[]>;
  notes: string[];
}

/* ------------------------------------------------------------------ *
 * 1. Participants — profils, comptes et rôles
 * ------------------------------------------------------------------ */

const PROFILES_TEMPLATE: SheetTemplate = {
  tab: 'Participants',
  purpose:
    "Feuille maîtresse des personnes : elle sert à la fois d'annuaire (profils affichés dans le réseautage et sur les badges) et de table de connexion. C'est elle qui décide de l'interface obtenue par chacun.",
  direction: 'lecture-écriture',
  headers: [
    'Email',
    'Nom',
    'Role',
    'Statut',
    'Institution',
    'Poste',
    'Pays',
    'Ville',
    'Interets',
    'Telephone',
    'LinkedIn',
    'Bio',
    'Billet',
    'Attribue par',
    'Empreinte',
  ],
  rows: [
    [
      'aline.hounkpe@indabax.bj',
      'Aline Hounkpè',
      'Super-Admin',
      'Actif',
      'Comité IndabaX Bénin',
      'Coordinatrice générale',
      'Bénin',
      'Cotonou',
      'Politiques IA; Communauté; Formation',
      '+229 97 00 00 01',
      'linkedin.com/in/aline-hounkpe',
      "Coordonne IndabaX Bénin depuis 2024. Travaille sur l'accès à la formation en IA hors des grandes villes.",
      'INDABAX-BJ-2026-001',
      'Installation initiale',
      '',
    ],
    [
      'koffi.dossou@uac.bj',
      'Koffi Emmanuel Dossou',
      'Organisateur',
      'Actif',
      "Université d'Abomey-Calavi",
      'Responsable programme',
      'Bénin',
      'Abomey-Calavi',
      'Vision par ordinateur; Enseignement; PyTorch',
      '+229 97 00 00 02',
      '',
      "Enseignant-chercheur, monte le programme scientifique de l'édition 2026.",
      'INDABAX-BJ-2026-002',
      'Aline Hounkpè',
      '',
    ],
    [
      'aurelle.tchagna@deeplearningindaba.com',
      'Dr. Aurelle Tchagna',
      'Conférencier',
      'Actif',
      'Deep Learning Indaba',
      'Directrice de recherche IA',
      'Cameroun',
      'Yaoundé',
      'Vision par ordinateur; Santé; Éthique',
      '',
      'linkedin.com/in/aurelle-tchagna',
      "Dirige une équipe de recherche en imagerie médicale. Donne la keynote d'ouverture.",
      'INDABAX-BJ-2026-108',
      'Aline Hounkpè',
      '',
    ],
    [
      'grace.senou@epitech.eu',
      'Grace Senou',
      'Volontaire',
      'Actif',
      'Epitech Bénin',
      'Étudiante promo 2027',
      'Bénin',
      'Cotonou',
      'MLOps; Développement web; Accueil',
      '+229 97 00 00 04',
      '',
      "Tient l'accueil du jour 1 et le stand des ateliers.",
      'INDABAX-BJ-2026-178',
      'Koffi Emmanuel Dossou',
      '',
    ],
    [
      'amina.biotchane@uac.bj',
      'Amina Bio Tchané',
      'Participant',
      'Actif',
      'EPAC / UAC',
      'Étudiante Master IA',
      'Bénin',
      'Abomey-Calavi',
      'NLP; Fongbe; Traduction automatique',
      '',
      '',
      'Prépare un mémoire sur la traduction automatique fongbe-français.',
      'INDABAX-BJ-2026-042',
      'Koffi Emmanuel Dossou',
      '',
    ],
    [
      'rodrigue.sossou@startuphub.bj',
      'Rodrigue Sossou',
      'Participant',
      'En attente',
      'Startup Hub Cotonou',
      'Ingénieur données',
      'Bénin',
      'Cotonou',
      'Séries temporelles; Agriculture; Hackathon',
      '',
      '',
      '',
      'INDABAX-BJ-2026-211',
      'Koffi Emmanuel Dossou',
      '',
    ],
    [
      'partenaire@semecity.bj',
      'Sèmè City',
      'Sponsor',
      'Actif',
      'Sèmè City',
      'Partenaire institutionnel',
      'Bénin',
      'Sèmè-Podji',
      'Innovation; Formation; Financement',
      '',
      '',
      "Campus d'innovation partenaire de l'édition 2026.",
      'INDABAX-BJ-2026-900',
      'Aline Hounkpè',
      '',
    ],
  ],
  requiredColumns: ['Email'],
  aliases: {
    Email: ['Adresse email', 'Mail', 'E-mail', 'Courriel'],
    Nom: ['Nom complet', 'Name', 'Prénom Nom', 'Participant'],
    Role: ['Rôle', 'Profil', 'Fonction', 'Type', 'Catégorie'],
    Statut: ['Status', 'État', 'Actif', 'Validation'],
    Institution: ['Organisation', 'Structure', 'Entreprise', 'Université', 'Affiliation'],
    Poste: ['Position', 'Titre', 'Job'],
    Pays: ['Country'],
    Ville: ['City'],
    Interets: ["Centres d'intérêt", 'Interests', 'Tags', 'Thématiques'],
    Telephone: ['Téléphone', 'Phone', 'Tel', 'WhatsApp'],
    LinkedIn: ['Linked in', 'Profil LinkedIn', 'Reseau', 'Réseau'],
    Bio: ['Biographie', 'Présentation', 'A propos', 'À propos'],
    Billet: ['Ticket', 'Ticket number', 'Numéro billet', 'Badge', 'ID'],
    Empreinte: ['Hash', 'Mot de passe', 'Password', 'Motdepasse'],
  },
  notes: [
    'Cet onglet remplace les deux anciens, « Utilisateurs » et « Participants » : une personne, une ligne, un seul endroit à tenir à jour.',
    'Rôles reconnus en français comme en anglais : Super-Admin / Admin, Organisateur / Organizer / Staff, Conférencier / Speaker / Intervenant, Volontaire / Bénévole / Volunteer, Sponsor / Partenaire, Participant / Attendee.',
    'Statuts reconnus : Actif, En attente, Suspendu. Un compte suspendu ne peut plus se connecter et ses sessions ouvertes sont fermées.',
    "La colonne « Empreinte » est écrite par le serveur, jamais par vous : elle contient l'empreinte scrypt du mot de passe que la personne a choisi, dont on ne peut pas retrouver le mot de passe. Laissez-la vide à la création ; ne la recopiez pas d'une ligne à l'autre.",
    "Aucun mot de passe en clair ne figure dans ce classeur. Une ligne dont l'empreinte est vide correspond à un compte encore à activer : la personne choisira son mot de passe elle-même, en s'inscrivant avec son email.",
    "Les centres d'intérêt se séparent par point-virgule, virgule ou barre verticale.",
    "Le numéro de billet est facultatif : il est généré s'il manque.",
    "Une ligne sans email est ignorée : c'est l'email qui identifie une personne.",
  ],
};

/* ------------------------------------------------------------------ *
 * 2. Sessions — programme
 * ------------------------------------------------------------------ */

const SESSIONS_TEMPLATE: SheetTemplate = {
  tab: 'Sessions',
  purpose: 'Programme des trois journées : horaires, salles, intervenants et thématiques.',
  direction: 'lecture',
  headers: [
    'ID',
    'Titre',
    'Conferencier',
    'Institution',
    'Jour',
    'Date',
    'Heure debut',
    'Heure fin',
    'Salle',
    'Track',
    'Type',
    'Niveau',
    'Capacite',
    'Description',
  ],
  rows: [
    [
      'ses-101',
      "Keynote d'ouverture : l'essor de l'IA en Afrique de l'Ouest",
      'Dr. Aurelle Tchagna',
      'Deep Learning Indaba',
      '1',
      '2026-09-18',
      '09:00',
      '10:30',
      'Amphithéâtre Houdégbé (UAC)',
      'Keynote',
      'Keynote',
      'Tous niveaux',
      '350',
      "Opportunités et défis du Deep Learning en Afrique de l'Ouest.",
    ],
    [
      'ses-102',
      'Workshop pratique : réseaux de neurones et PyTorch moderne',
      'Koffi Emmanuel Dossou',
      "Laboratoire d'informatique UAC",
      '1',
      '2026-09-18',
      '11:00',
      '13:00',
      'Lab IA - Salle Turing',
      'Fondamentaux ML',
      'Workshop',
      'Débutant',
      '60',
      "Construire un MLP et un CNN à partir de zéro. Prévoir un ordinateur portable.",
    ],
    [
      'ses-201',
      'NLP et LLM pour les langues africaines : Fongbe et Yoruba',
      'Bonaventure Dossou',
      'Lanfrica / Mila',
      '2',
      '2026-09-19',
      '09:00',
      '10:30',
      'Amphithéâtre Houdégbé (UAC)',
      'NLP & Langues Africaines',
      'Paper Presentation',
      'Intermédiaire',
      '350',
      'Constitution de corpus et traduction automatique pour les langues béninoises.',
    ],
  ],
  requiredColumns: ['Titre'],
  aliases: {
    Titre: ['Title', 'Session', 'Intitulé'],
    Conferencier: ['Conférencier', 'Speaker', 'Intervenant', 'Orateur'],
    Jour: ['Day'],
    'Heure debut': ['Heure début', 'Start time', 'Début', 'Horaire début'],
    'Heure fin': ['End time', 'Fin', 'Horaire fin'],
    Salle: ['Room', 'Lieu'],
    Track: ['Thématique', 'Thème'],
    Type: ['Format'],
    Niveau: ['Level'],
    Capacite: ['Capacité', 'Capacity', 'Places'],
    Description: ['Résumé', 'Abstract'],
  },
  notes: [
    'Thématiques reconnues : NLP & Langues Africaines, Computer Vision & Santé, Fondamentaux ML, Generative AI & LLMs, Entrepreneuriat & Éthique, Keynote. Une valeur inconnue retombe sur « Fondamentaux ML ».',
    'Types reconnus : Keynote, Workshop, Paper Presentation, Panel, Hackathon, Networking.',
    'Niveaux reconnus : Débutant, Intermédiaire, Avancé, Tous niveaux.',
    'Format de date attendu : AAAA-MM-JJ. Horaires en 24 h, par exemple 14:30.',
  ],
};

/* ------------------------------------------------------------------ *
 * 3. Check-ins — émargements
 * ------------------------------------------------------------------ */

const CHECKINS_TEMPLATE: SheetTemplate = {
  tab: 'Check-ins',
  purpose:
    "Émargements : le serveur y ajoute une ligne à chaque scan de QR code. Vous n'avez qu'à créer la feuille et sa ligne d'en-têtes.",
  direction: 'écriture',
  headers: ['Horodateur', 'Nom', 'Email', 'Billet', 'SessionID', 'Session', 'Salle', 'Scanne par'],
  rows: [
    [
      '18/09/2026 09:12:40',
      'Amina Bio Tchané',
      'amina.biotchane@uac.bj',
      'INDABAX-BJ-2026-042',
      'ses-101',
      "Keynote d'ouverture : l'essor de l'IA en Afrique de l'Ouest",
      'Amphithéâtre Houdégbé (UAC)',
      'Grace Senou',
    ],
    [
      '18/09/2026 11:04:07',
      'Amina Bio Tchané',
      'amina.biotchane@uac.bj',
      'INDABAX-BJ-2026-042',
      'ses-102',
      'Workshop pratique : réseaux de neurones et PyTorch moderne',
      'Lab IA - Salle Turing',
      'Grace Senou',
    ],
    [
      '19/09/2026 09:03:55',
      'Rodrigue Sossou',
      'rodrigue.sossou@startuphub.bj',
      'INDABAX-BJ-2026-231',
      'ses-201',
      'NLP et LLM pour les langues africaines : Fongbe et Yoruba',
      'Amphithéâtre Houdégbé (UAC)',
      'Koffi Emmanuel Dossou',
    ],
  ],
  requiredColumns: [],
  aliases: {},
  notes: [
    "Feuille alimentée par l'application : ne la remplissez pas à la main, sauf pour un rattrapage.",
    "La colonne « Scanne par » est renseignée par le serveur avec le nom de la personne réellement connectée : elle ne peut pas être falsifiée depuis le navigateur.",
    "L'écriture exige une voie configurée : Apps Script Web App ou API AppSheet.",
    'Seuls les rôles habilités à scanner (organisateur, volontaire, administrateur) peuvent créer ces lignes.',
  ],
};

/* ------------------------------------------------------------------ *
 * 4. Feedbacks — évaluations des sessions
 * ------------------------------------------------------------------ */

const FEEDBACKS_TEMPLATE: SheetTemplate = {
  tab: 'Feedbacks',
  purpose:
    'Évaluations des sessions : notes de 1 à 5, commentaires et questions posées aux intervenants. Alimentée par l’application.',
  direction: 'écriture',
  headers: [
    'Horodateur',
    'Session',
    'Nom',
    'Note globale',
    'Qualite contenu',
    'Clarte orateur',
    'Utilite pratique',
    'Commentaires',
    'Question',
  ],
  rows: [
    [
      '18/09/2026 10:35:12',
      "Keynote d'ouverture : l'essor de l'IA en Afrique de l'Ouest",
      'Amina Bio Tchané',
      '5',
      '5',
      '5',
      '4',
      'Cadrage très clair sur les enjeux de souveraineté des données.',
      'Comment financer une thèse en IA au Bénin ?',
    ],
    [
      '18/09/2026 13:08:44',
      'Workshop pratique : réseaux de neurones et PyTorch moderne',
      'Rodrigue Sossou',
      '4',
      '5',
      '4',
      '5',
      'Excellents exercices. Il manquait un peu de temps pour la partie CNN.',
      '',
    ],
    [
      '19/09/2026 10:32:19',
      'NLP et LLM pour les langues africaines : Fongbe et Yoruba',
      'Amina Bio Tchané',
      '5',
      '5',
      '4',
      '5',
      'Les corpus présentés vont directement servir à mon mémoire.',
      'Les jeux de données Fongbe sont-ils publiés sous licence ouverte ?',
    ],
  ],
  requiredColumns: [],
  aliases: {},
  notes: [
    'Les quatre notes vont de 1 à 5 ; le serveur borne toute valeur hors de cet intervalle.',
    "La colonne « Nom » est celle de la personne connectée : le serveur l'inscrit lui-même.",
    'La colonne « Question » reste vide quand le participant n’en a pas posé.',
  ],
};

/* ------------------------------------------------------------------ *
 * 5. Annonces — communications officielles
 * ------------------------------------------------------------------ */

const ANNOUNCEMENTS_TEMPLATE: SheetTemplate = {
  tab: 'Annonces',
  purpose:
    "Annonces publiées à tout l'événement. L'application les lit et y ajoute une ligne à chaque publication : c'est ce classeur qui les rend visibles de tous, sur tous les appareils.",
  direction: 'lecture-écriture',
  headers: [
    'ID',
    'Horodateur',
    'Categorie',
    'Titre',
    'Message',
    'Auteur',
    'Email auteur',
    'Role',
    'Epingle',
    'Retire',
    'Reactions',
  ],
  rows: [
    [
      'ann-001',
      '18/09/2026 08:05:00',
      'PROGRAMME',
      'Ouverture des portes à 8 h 30',
      "L'accueil se fait à l'entrée principale de l'UAC. Munissez-vous de votre QR code.",
      'Aline Hounkpè',
      'aline.hounkpe@indabax.bj',
      'Super-Admin',
      'oui',
      '',
      '',
    ],
    [
      'ann-002',
      '18/09/2026 12:40:00',
      'LOGISTIQUE',
      'Déjeuner servi au hall Sud',
      'Le déjeuner est servi de 13 h à 14 h 15. Les repas végétariens sont signalés par une étiquette verte.',
      'Grace Senou',
      'grace.senou@epitech.eu',
      'Volontaire',
      '',
      '',
      '',
    ],
    [
      'ann-003',
      '19/09/2026 09:15:00',
      'URGENT',
      'Changement de salle pour le workshop PyTorch',
      "Le workshop de 11 h passe du Lab Turing à l'amphithéâtre Houdégbé : la salle prévue a un problème électrique.",
      'Koffi Emmanuel Dossou',
      'koffi.dossou@uac.bj',
      'Organisateur',
      'oui',
      '',
      '',
    ],
  ],
  requiredColumns: ['Message'],
  aliases: {
    ID: ['Identifiant'],
    Horodateur: ['Date', 'Publie le', 'Publié le', 'Timestamp'],
    Categorie: ['Catégorie', 'Type', 'Priorite', 'Priorité'],
    Titre: ['Title', 'Objet'],
    Message: ['Contenu', 'Texte', 'Corps', 'Body'],
    Auteur: ['Author', 'Publie par', 'Publié par'],
    'Email auteur': ['Email', 'Auteur email'],
    Role: ['Rôle', 'Fonction'],
    Epingle: ['Épinglé', 'Pinned', 'Important'],
    Retire: ['Retiré', 'Supprime', 'Supprimé', 'Masque', 'Masqué'],
    Reactions: ['Réactions', 'Jaime', "J'aime", 'Likes'],
  },
  notes: [
    'Catégories reconnues : URGENT, PROGRAMME, LOGISTIQUE, KEYNOTE, SOCIAL, HACKATHON. Une valeur inconnue retombe sur PROGRAMME.',
    "Seuls les rôles autorisés à diffuser (Super-Admin, Organisateur) peuvent publier depuis l'application ; toute ligne ajoutée à la main est lue de la même façon.",
    "Une annonce n'est jamais effacée : la retirer inscrit « oui » dans la colonne « Retire », ce qui la masque sans perdre la trace de ce qui a été dit.",
    'Les colonnes « Epingle » et « Retire » acceptent oui / non, vrai / faux, true / false, 1 / 0.',
    "La colonne « Reactions » tient la liste des emails ayant marqué « j'aime », séparés par des points-virgules. Elle est écrite par l'application.",
  ],
};

/* ------------------------------------------------------------------ *
 * 6. Messages — discussions et commentaires
 * ------------------------------------------------------------------ */

const MESSAGES_TEMPLATE: SheetTemplate = {
  tab: 'Messages',
  purpose:
    "Un seul fil de messages pour les salons de discussion et les commentaires sous les annonces : la colonne « Fil » dit à quoi le message se rattache.",
  direction: 'lecture-écriture',
  headers: [
    'ID',
    'Horodateur',
    'Fil',
    'Auteur',
    'Email auteur',
    'Role',
    'Message',
    'Retire',
    'Reactions',
  ],
  rows: [
    [
      'msg-001',
      '18/09/2026 09:40:12',
      'canal:general',
      'Amina Bio Tchané',
      'amina.biotchane@uac.bj',
      'Participant',
      "Bonjour à tous ! Étudiante en Master IA à l'UAC, je travaille sur le fongbe. Ravie d'être là.",
      '',
      '',
    ],
    [
      'msg-002',
      '18/09/2026 09:44:03',
      'canal:general',
      'Grace Senou',
      'grace.senou@epitech.eu',
      'Volontaire',
      'Bienvenue Amina ! Le stand des ateliers est à droite en entrant si tu cherches ton badge.',
      '',
      '',
    ],
    [
      'msg-003',
      '19/09/2026 09:18:44',
      'annonce:ann-003',
      'Rodrigue Sossou',
      'rodrigue.sossou@startuphub.bj',
      'Participant',
      "Merci pour l'info. Le matériel du workshop est déplacé aussi ?",
      '',
      '',
    ],
    [
      'msg-004',
      '19/09/2026 09:22:10',
      'annonce:ann-003',
      'Koffi Emmanuel Dossou',
      'koffi.dossou@uac.bj',
      'Organisateur',
      'Oui, tout est transféré. Apportez seulement votre ordinateur portable.',
      '',
      '',
    ],
  ],
  requiredColumns: ['Message'],
  aliases: {
    ID: ['Identifiant'],
    Horodateur: ['Date', 'Envoye le', 'Envoyé le', 'Timestamp'],
    Fil: ['Thread', 'Canal', 'Salon', 'Rattachement', 'Contexte'],
    Auteur: ['Author', 'Nom', 'Expediteur', 'Expéditeur'],
    'Email auteur': ['Email', 'Auteur email'],
    Role: ['Rôle'],
    Message: ['Contenu', 'Texte', 'Body'],
    Retire: ['Retiré', 'Supprime', 'Supprimé', 'Masque', 'Masqué'],
    Reactions: ['Réactions', 'Jaime', "J'aime", 'Likes'],
  },
  notes: [
    "La colonne « Fil » vaut « canal:<identifiant> » pour un message de salon, ou « annonce:<identifiant> » pour un commentaire sous l'annonce correspondante. C'est ce qui permet de tenir les deux usages dans une seule feuille.",
    'Salons prévus : canal:general, canal:nlp, canal:vision, canal:hackathon, canal:emplois. Un identifiant inconnu crée simplement un fil de plus.',
    "Comme pour les annonces, un message retiré porte « oui » dans « Retire » : il disparaît de l'application, la ligne reste.",
    "L'auteur, son email et son rôle sont inscrits par le serveur d'après la session : personne ne peut publier sous le nom d'un autre.",
  ],
};

export const SHEET_TEMPLATES: SheetTemplate[] = [
  PROFILES_TEMPLATE,
  SESSIONS_TEMPLATE,
  CHECKINS_TEMPLATE,
  FEEDBACKS_TEMPLATE,
  ANNOUNCEMENTS_TEMPLATE,
  MESSAGES_TEMPLATE,
];

export function findTemplate(tab: string): SheetTemplate | undefined {
  return SHEET_TEMPLATES.find(template => template.tab === tab);
}

/* ------------------------------------------------------------------ *
 * Génération CSV
 * ------------------------------------------------------------------ */

/** Échappe une valeur selon la RFC 4180. */
function toCsvValue(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function templateToCsv(template: SheetTemplate): string {
  return [template.headers, ...template.rows]
    .map(row => row.map(toCsvValue).join(','))
    .join('\r\n');
}

/** Déclenche le téléchargement d'un onglet au format CSV. */
export function downloadTemplateCsv(template: SheetTemplate): void {
  // Le BOM UTF-8 évite que Google Sheets et Excel abîment les accents.
  const blob = new Blob([`﻿${templateToCsv(template)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `indabax-modele-${template.tab.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Télécharge tous les onglets, un fichier par onglet. */
export function downloadAllTemplates(): void {
  SHEET_TEMPLATES.forEach((template, index) => {
    // Les navigateurs ignorent des téléchargements simultanés : on les espace.
    setTimeout(() => downloadTemplateCsv(template), index * 350);
  });
}
