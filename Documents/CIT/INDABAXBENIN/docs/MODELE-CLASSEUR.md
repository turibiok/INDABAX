# Modèle du classeur Google Sheet

Ce document décrit le classeur qui sert de base de données à l'application IndabaX Bénin. Il est **généré** depuis `src/data/sheetTemplates.ts` : ne le modifiez pas à la main, éditez la source puis relancez `npm run docs:sheets`.

## Mise en place

1. Créez un classeur Google Sheet, ou réutilisez celui de votre application AppSheet.
2. Créez un onglet par feuille décrite ci-dessous, en recopiant la ligne d'en-têtes. Les modèles sont téléchargeables au format CSV depuis l'application : **Base Google Sheet → Modèles des feuilles**.
3. Partagez le classeur en lecture avec « Tous les utilisateurs disposant du lien » : sans cela, le serveur reçoit une page de connexion à la place des données.
4. Dans l'application, connectez-vous avec un email de `ADMIN_EMAILS`, puis collez le lien du classeur dans **Base Google Sheet → Classeur & rôles** et cliquez sur « Tester et lier le classeur ».
5. Pour que l'application puisse **écrire** les émargements et les feedbacks, déployez le script Apps Script fourni dans l'onglet **Écriture**, ou renseignez les identifiants de l'API AppSheet.

## Ce que le serveur seul connaît

Le lien du classeur, l'URL du Apps Script et la clé AppSheet sont enregistrés dans `.data/server-state.json`, hors du dépôt Git. Ils ne redescendent jamais dans le navigateur. Les mots de passe ne sont conservés que sous forme d'empreinte scrypt.

## Résumé des onglets

| Onglet | Rôle | Sens |
| --- | --- | --- |
| `Utilisateurs` | Table d'authentification : un email, un mot de passe et le rôle que vous attribuez. | lecture |
| `Participants` | Annuaire de l'événement : profils affichés dans le réseautage et sur les badges. | lecture |
| `Sessions` | Programme des trois journées : horaires, salles, intervenants et thématiques. | lecture |
| `Check-ins` | Émargements : le serveur y ajoute une ligne à chaque scan de QR code. | écriture |
| `Feedbacks` | Évaluations des sessions : notes de 1 à 5, commentaires et questions posées aux intervenants. | écriture |

---

## 1. Onglet `Utilisateurs`

**Rôle.** Table d'authentification : un email, un mot de passe et le rôle que vous attribuez. C'est cette feuille qui décide de l'interface obtenue par chacun.

**Sens.** Lue par l'application. Vous la remplissez, elle ne la modifie pas.

**Colonne indispensable.** `Email`

### Colonnes et exemple

| Email | Nom | Role | Statut | Mot de passe | Institution | Poste | Attribue par |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aline.hounkpe@indabax.bj | Aline Hounkpè | Super-Admin | Actif | Baobab2026! | Comité IndabaX Bénin | Coordinatrice générale | Installation initiale |
| koffi.dossou@uac.bj | Koffi Emmanuel Dossou | Organisateur | Actif | Cotonou#Prog | Université d'Abomey-Calavi | Responsable programme | Aline Hounkpè |
| aurelle.tchagna@deeplearningindaba.com | Dr. Aurelle Tchagna | Conférencier | Actif | Keynote-2026 | Deep Learning Indaba | Directrice de recherche IA | Aline Hounkpè |
| grace.senou@epitech.eu | Grace Senou | Volontaire | Actif | AccueilJ1-77 | Epitech Bénin | Étudiante promo 2027 | Koffi Emmanuel Dossou |
| amina.biotchane@uac.bj | Amina Bio Tchané | Participant | Actif | Fongbe-NLP-12 | EPAC / UAC | Étudiante Master IA | Koffi Emmanuel Dossou |
| rodrigue.sossou@startuphub.bj | Rodrigue Sossou | Participant | En attente | Hackathon-J3 | Startup Hub Cotonou | Ingénieur données | Koffi Emmanuel Dossou |
| partenaire@semecity.bj | Sèmè City | Sponsor | Actif | Partenaire-26 | Sèmè City | Partenaire institutionnel | Aline Hounkpè |

### Libellés de colonnes également acceptés

La lecture ignore les accents, les majuscules et les séparateurs. Ces variantes fonctionnent aussi :

- `Email` — `Adresse email`, `Mail`, `E-mail`, `Courriel`
- `Nom` — `Nom complet`, `Name`, `Prénom Nom`, `Participant`
- `Role` — `Rôle`, `Profil`, `Fonction`, `Type`, `Catégorie`
- `Statut` — `Status`, `État`, `Actif`, `Validation`
- `Mot de passe` — `Password`, `Motdepasse`, `Code`, `Code d'accès`, `PIN`
- `Institution` — `Organisation`, `Structure`, `Entreprise`, `Université`, `Affiliation`
- `Poste` — `Position`, `Titre`, `Job`

### À savoir

- Rôles reconnus en français comme en anglais : Super-Admin / Admin, Organisateur / Organizer / Staff, Conférencier / Speaker / Intervenant, Volontaire / Bénévole / Volunteer, Sponsor / Partenaire, Participant / Attendee.
- Statuts reconnus : Actif, En attente, Suspendu. Un compte suspendu ne peut plus se connecter et ses sessions ouvertes sont fermées.
- Le mot de passe est lu une fois puis remplacé par une empreinte côté serveur : il n'est jamais stocké en clair ailleurs que dans cette feuille.
- Un participant qui change son mot de passe depuis l'application garde le sien : remplir à nouveau la cellule le réinitialise.
- Réservez la vue de cet onglet aux organisateurs : il contient les mots de passe initiaux.

---

## 2. Onglet `Participants`

**Rôle.** Annuaire de l'événement : profils affichés dans le réseautage et sur les badges. Cette feuille ne sert pas à la connexion.

**Sens.** Lue par l'application. Vous la remplissez, elle ne la modifie pas.

**Colonne indispensable.** `Nom`

### Colonnes et exemple

| ID | Billet | Nom | Email | Role | Institution | Poste | Pays | Ville | Interets |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| usr-001 | INDABAX-BJ-2026-001 | Aline Hounkpè | aline.hounkpe@indabax.bj | Super-Admin | Comité IndabaX Bénin | Coordinatrice générale | Bénin | Cotonou | Politiques IA; Communauté; Formation |
| usr-002 | INDABAX-BJ-2026-042 | Amina Bio Tchané | amina.biotchane@uac.bj | Participant | EPAC / UAC | Étudiante Master IA | Bénin | Abomey-Calavi | NLP; Fongbe; Traduction automatique |
| usr-003 | INDABAX-BJ-2026-108 | Dr. Aurelle Tchagna | aurelle.tchagna@deeplearningindaba.com | Conférencier | Deep Learning Indaba | Directrice de recherche IA | Cameroun | Yaoundé | Vision par ordinateur; Santé; Éthique |
| usr-004 | INDABAX-BJ-2026-178 | Grace Senou | grace.senou@epitech.eu | Volontaire | Epitech Bénin | Étudiante promo 2027 | Bénin | Cotonou | MLOps; Développement web; Accueil |

### Libellés de colonnes également acceptés

La lecture ignore les accents, les majuscules et les séparateurs. Ces variantes fonctionnent aussi :

- `ID` — `Identifiant`
- `Billet` — `Ticket`, `Ticket number`, `Numéro billet`, `Badge`
- `Nom` — `Nom complet`, `Name`, `Participant`
- `Email` — `Adresse email`, `Mail`, `Courriel`
- `Role` — `Rôle`, `Profil`, `Fonction`, `Type`
- `Institution` — `Organisation`, `Structure`, `Université`
- `Poste` — `Position`, `Titre`
- `Pays` — `Country`
- `Ville` — `City`
- `Interets` — `Centres d'intérêt`, `Interests`, `Tags`

### À savoir

- Les centres d'intérêt se séparent par point-virgule, virgule ou barre verticale.
- L'ID et le numéro de billet sont facultatifs : ils sont générés si la colonne est vide.
- Une ligne sans nom ni email est ignorée.

---

## 3. Onglet `Sessions`

**Rôle.** Programme des trois journées : horaires, salles, intervenants et thématiques.

**Sens.** Lue par l'application. Vous la remplissez, elle ne la modifie pas.

**Colonne indispensable.** `Titre`

### Colonnes et exemple

| ID | Titre | Conferencier | Institution | Jour | Date | Heure debut | Heure fin | Salle | Track | Type | Niveau | Capacite | Description |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ses-101 | Keynote d'ouverture : l'essor de l'IA en Afrique de l'Ouest | Dr. Aurelle Tchagna | Deep Learning Indaba | 1 | 2026-09-18 | 09:00 | 10:30 | Amphithéâtre Houdégbé (UAC) | Keynote | Keynote | Tous niveaux | 350 | Opportunités et défis du Deep Learning en Afrique de l'Ouest. |
| ses-102 | Workshop pratique : réseaux de neurones et PyTorch moderne | Koffi Emmanuel Dossou | Laboratoire d'informatique UAC | 1 | 2026-09-18 | 11:00 | 13:00 | Lab IA - Salle Turing | Fondamentaux ML | Workshop | Débutant | 60 | Construire un MLP et un CNN à partir de zéro. Prévoir un ordinateur portable. |
| ses-201 | NLP et LLM pour les langues africaines : Fongbe et Yoruba | Bonaventure Dossou | Lanfrica / Mila | 2 | 2026-09-19 | 09:00 | 10:30 | Amphithéâtre Houdégbé (UAC) | NLP & Langues Africaines | Paper Presentation | Intermédiaire | 350 | Constitution de corpus et traduction automatique pour les langues béninoises. |

### Libellés de colonnes également acceptés

La lecture ignore les accents, les majuscules et les séparateurs. Ces variantes fonctionnent aussi :

- `Titre` — `Title`, `Session`, `Intitulé`
- `Conferencier` — `Conférencier`, `Speaker`, `Intervenant`, `Orateur`
- `Jour` — `Day`
- `Heure debut` — `Heure début`, `Start time`, `Début`, `Horaire début`
- `Heure fin` — `End time`, `Fin`, `Horaire fin`
- `Salle` — `Room`, `Lieu`
- `Track` — `Thématique`, `Thème`
- `Type` — `Format`
- `Niveau` — `Level`
- `Capacite` — `Capacité`, `Capacity`, `Places`
- `Description` — `Résumé`, `Abstract`

### À savoir

- Thématiques reconnues : NLP & Langues Africaines, Computer Vision & Santé, Fondamentaux ML, Generative AI & LLMs, Entrepreneuriat & Éthique, Keynote. Une valeur inconnue retombe sur « Fondamentaux ML ».
- Types reconnus : Keynote, Workshop, Paper Presentation, Panel, Hackathon, Networking.
- Niveaux reconnus : Débutant, Intermédiaire, Avancé, Tous niveaux.
- Format de date attendu : AAAA-MM-JJ. Horaires en 24 h, par exemple 14:30.

---

## 4. Onglet `Check-ins`

**Rôle.** Émargements : le serveur y ajoute une ligne à chaque scan de QR code. Vous n'avez qu'à créer la feuille et sa ligne d'en-têtes.

**Sens.** Remplie par l'application. Créez seulement l'onglet et sa ligne d'en-têtes.

### Colonnes et exemple

| Horodateur | Nom | Email | Billet | SessionID | Session | Salle | Scanne par |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 18/09/2026 09:12:40 | Amina Bio Tchané | amina.biotchane@uac.bj | INDABAX-BJ-2026-042 | ses-101 | Keynote d'ouverture : l'essor de l'IA en Afrique de l'Ouest | Amphithéâtre Houdégbé (UAC) | Grace Senou |
| 18/09/2026 11:04:07 | Amina Bio Tchané | amina.biotchane@uac.bj | INDABAX-BJ-2026-042 | ses-102 | Workshop pratique : réseaux de neurones et PyTorch moderne | Lab IA - Salle Turing | Grace Senou |
| 19/09/2026 09:03:55 | Rodrigue Sossou | rodrigue.sossou@startuphub.bj | INDABAX-BJ-2026-231 | ses-201 | NLP et LLM pour les langues africaines : Fongbe et Yoruba | Amphithéâtre Houdégbé (UAC) | Koffi Emmanuel Dossou |

### À savoir

- Feuille alimentée par l'application : ne la remplissez pas à la main, sauf pour un rattrapage.
- La colonne « Scanne par » est renseignée par le serveur avec le nom de la personne réellement connectée : elle ne peut pas être falsifiée depuis le navigateur.
- L'écriture exige une voie configurée : Apps Script Web App ou API AppSheet.
- Seuls les rôles habilités à scanner (organisateur, volontaire, administrateur) peuvent créer ces lignes.

---

## 5. Onglet `Feedbacks`

**Rôle.** Évaluations des sessions : notes de 1 à 5, commentaires et questions posées aux intervenants. Alimentée par l’application.

**Sens.** Remplie par l'application. Créez seulement l'onglet et sa ligne d'en-têtes.

### Colonnes et exemple

| Horodateur | Session | Nom | Note globale | Qualite contenu | Clarte orateur | Utilite pratique | Commentaires | Question |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 18/09/2026 10:35:12 | Keynote d'ouverture : l'essor de l'IA en Afrique de l'Ouest | Amina Bio Tchané | 5 | 5 | 5 | 4 | Cadrage très clair sur les enjeux de souveraineté des données. | Comment financer une thèse en IA au Bénin ? |
| 18/09/2026 13:08:44 | Workshop pratique : réseaux de neurones et PyTorch moderne | Rodrigue Sossou | 4 | 5 | 4 | 5 | Excellents exercices. Il manquait un peu de temps pour la partie CNN. | _(vide)_ |
| 19/09/2026 10:32:19 | NLP et LLM pour les langues africaines : Fongbe et Yoruba | Amina Bio Tchané | 5 | 5 | 4 | 5 | Les corpus présentés vont directement servir à mon mémoire. | Les jeux de données Fongbe sont-ils publiés sous licence ouverte ? |

### À savoir

- Les quatre notes vont de 1 à 5 ; le serveur borne toute valeur hors de cet intervalle.
- La colonne « Nom » est celle de la personne connectée : le serveur l'inscrit lui-même.
- La colonne « Question » reste vide quand le participant n’en a pas posé.

---

## Annexe : les mêmes feuilles au format CSV

Collez ces blocs dans un fichier `.csv` puis importez-le dans Google Sheets (**Fichier → Importer**), ou téléchargez-les directement depuis l'application.

### Utilisateurs

```csv
Email,Nom,Role,Statut,Mot de passe,Institution,Poste,Attribue par
aline.hounkpe@indabax.bj,Aline Hounkpè,Super-Admin,Actif,Baobab2026!,Comité IndabaX Bénin,Coordinatrice générale,Installation initiale
koffi.dossou@uac.bj,Koffi Emmanuel Dossou,Organisateur,Actif,Cotonou#Prog,Université d'Abomey-Calavi,Responsable programme,Aline Hounkpè
aurelle.tchagna@deeplearningindaba.com,Dr. Aurelle Tchagna,Conférencier,Actif,Keynote-2026,Deep Learning Indaba,Directrice de recherche IA,Aline Hounkpè
grace.senou@epitech.eu,Grace Senou,Volontaire,Actif,AccueilJ1-77,Epitech Bénin,Étudiante promo 2027,Koffi Emmanuel Dossou
amina.biotchane@uac.bj,Amina Bio Tchané,Participant,Actif,Fongbe-NLP-12,EPAC / UAC,Étudiante Master IA,Koffi Emmanuel Dossou
rodrigue.sossou@startuphub.bj,Rodrigue Sossou,Participant,En attente,Hackathon-J3,Startup Hub Cotonou,Ingénieur données,Koffi Emmanuel Dossou
partenaire@semecity.bj,Sèmè City,Sponsor,Actif,Partenaire-26,Sèmè City,Partenaire institutionnel,Aline Hounkpè
```

### Participants

```csv
ID,Billet,Nom,Email,Role,Institution,Poste,Pays,Ville,Interets
usr-001,INDABAX-BJ-2026-001,Aline Hounkpè,aline.hounkpe@indabax.bj,Super-Admin,Comité IndabaX Bénin,Coordinatrice générale,Bénin,Cotonou,Politiques IA; Communauté; Formation
usr-002,INDABAX-BJ-2026-042,Amina Bio Tchané,amina.biotchane@uac.bj,Participant,EPAC / UAC,Étudiante Master IA,Bénin,Abomey-Calavi,NLP; Fongbe; Traduction automatique
usr-003,INDABAX-BJ-2026-108,Dr. Aurelle Tchagna,aurelle.tchagna@deeplearningindaba.com,Conférencier,Deep Learning Indaba,Directrice de recherche IA,Cameroun,Yaoundé,Vision par ordinateur; Santé; Éthique
usr-004,INDABAX-BJ-2026-178,Grace Senou,grace.senou@epitech.eu,Volontaire,Epitech Bénin,Étudiante promo 2027,Bénin,Cotonou,MLOps; Développement web; Accueil
```

### Sessions

```csv
ID,Titre,Conferencier,Institution,Jour,Date,Heure debut,Heure fin,Salle,Track,Type,Niveau,Capacite,Description
ses-101,Keynote d'ouverture : l'essor de l'IA en Afrique de l'Ouest,Dr. Aurelle Tchagna,Deep Learning Indaba,1,2026-09-18,09:00,10:30,Amphithéâtre Houdégbé (UAC),Keynote,Keynote,Tous niveaux,350,Opportunités et défis du Deep Learning en Afrique de l'Ouest.
ses-102,Workshop pratique : réseaux de neurones et PyTorch moderne,Koffi Emmanuel Dossou,Laboratoire d'informatique UAC,1,2026-09-18,11:00,13:00,Lab IA - Salle Turing,Fondamentaux ML,Workshop,Débutant,60,Construire un MLP et un CNN à partir de zéro. Prévoir un ordinateur portable.
ses-201,NLP et LLM pour les langues africaines : Fongbe et Yoruba,Bonaventure Dossou,Lanfrica / Mila,2,2026-09-19,09:00,10:30,Amphithéâtre Houdégbé (UAC),NLP & Langues Africaines,Paper Presentation,Intermédiaire,350,Constitution de corpus et traduction automatique pour les langues béninoises.
```

### Check-ins

```csv
Horodateur,Nom,Email,Billet,SessionID,Session,Salle,Scanne par
18/09/2026 09:12:40,Amina Bio Tchané,amina.biotchane@uac.bj,INDABAX-BJ-2026-042,ses-101,Keynote d'ouverture : l'essor de l'IA en Afrique de l'Ouest,Amphithéâtre Houdégbé (UAC),Grace Senou
18/09/2026 11:04:07,Amina Bio Tchané,amina.biotchane@uac.bj,INDABAX-BJ-2026-042,ses-102,Workshop pratique : réseaux de neurones et PyTorch moderne,Lab IA - Salle Turing,Grace Senou
19/09/2026 09:03:55,Rodrigue Sossou,rodrigue.sossou@startuphub.bj,INDABAX-BJ-2026-231,ses-201,NLP et LLM pour les langues africaines : Fongbe et Yoruba,Amphithéâtre Houdégbé (UAC),Koffi Emmanuel Dossou
```

### Feedbacks

```csv
Horodateur,Session,Nom,Note globale,Qualite contenu,Clarte orateur,Utilite pratique,Commentaires,Question
18/09/2026 10:35:12,Keynote d'ouverture : l'essor de l'IA en Afrique de l'Ouest,Amina Bio Tchané,5,5,5,4,Cadrage très clair sur les enjeux de souveraineté des données.,Comment financer une thèse en IA au Bénin ?
18/09/2026 13:08:44,Workshop pratique : réseaux de neurones et PyTorch moderne,Rodrigue Sossou,4,5,4,5,Excellents exercices. Il manquait un peu de temps pour la partie CNN.,
19/09/2026 10:32:19,NLP et LLM pour les langues africaines : Fongbe et Yoruba,Amina Bio Tchané,5,5,4,5,Les corpus présentés vont directement servir à mon mémoire.,Les jeux de données Fongbe sont-ils publiés sous licence ouverte ?
```
