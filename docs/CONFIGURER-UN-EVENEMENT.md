# Configurer un événement

Cette application ne connaît aucun événement en particulier. Son nom, ses dates,
ses lieux, ses rôles, son logo et jusqu'aux mots de son interface viennent du
classeur Google Sheet que vous lui donnez. Un colloque, un stage de secourisme,
un tournoi ou un mariage s'y installent de la même façon.

Ce document explique comment.

---

## Le principe

Deux onglets du classeur portent la configuration :

| Onglet | Ce qu'il porte |
| --- | --- |
| `Configuration` | Nom, dates, lieu, contacts, logo, couleurs, vocabulaire |
| `Rôles` | Les rôles de l'événement et les droits de chacun |

Les deux sont **facultatifs**. Un classeur qui n'en a aucun fonctionne : les six
rôles livrés s'appliquent, et l'événement porte un nom générique jusqu'à ce que
vous le renseigniez.

Le serveur lit ces onglets au démarrage et les sert à tout le monde. C'est lui
qui fait autorité : ce que le navigateur affirme n'est jamais cru sur parole.

> **Pourquoi le classeur et non un fichier de configuration ?** Parce que vous
> pouvez le corriger à la main, qu'il survit à une remise à zéro du serveur, et
> que vous y êtes déjà pour gérer vos inscrits. La configuration vivait
> auparavant dans le navigateur : celui qui renommait l'événement était le seul
> au monde à voir le changement.

---

## L'onglet `Configuration`

Une ligne par réglage, deux colonnes : `Clé` et `Valeur`. Vous pouvez en ajouter
sans refaire la feuille ; une clé inconnue est ignorée sans bruit, ce qui permet
de s'en servir comme pense-bête.

### Identité

| Clé | Exemple |
| --- | --- |
| `eventName` | `Rencontres du Logiciel Libre` |
| `edition` | `2027` |
| `startDate` | `2027-03-12` |
| `endDate` | `2027-03-14` |
| `location` | `Porto-Novo, Bénin` |
| `venueAddress` | `Campus universitaire, Bâtiment C` |
| `themeDescription` | Une phrase sur le propos de l'événement |
| `contactEmail` | `contact@exemple.org` |
| `websiteUrl` | `https://exemple.org` |
| `twitterHandle` | `@exemple` |
| `linkedinUrl` | `https://linkedin.com/company/exemple` |
| `ticketPrefix` | `RLL-2027` |
| `senderEmail` | `event@exemple.org` |
| `senderName` | `Rencontres du Logiciel Libre` |

Les dates s'écrivent `AAAA-MM-JJ`. L'application les met en forme elle-même :
`2027-03-12` et `2027-03-14` s'affichent « 12 – 14 mars 2027 ».

`ticketPrefix` mérite un mot. Laissé vide, il est fabriqué depuis les initiales
du nom : « Rencontres du Logiciel Libre » 2027 donnerait `RDLL-2027`. Renseignez-le
si vos billets ont déjà été distribués sous un autre préfixe — sans quoi deux
personnes du même événement auraient des billets de formes différentes.

### Envoi des emails

L'application écrit à ses participants pour une seule chose : les liens de
réinitialisation de mot de passe. Ces messages partent par le Apps Script, donc
depuis un compte Google — aucun service tiers, aucune clé supplémentaire.

| Clé | Ce qu'elle fait |
| --- | --- |
| `senderEmail` | Adresse d'expédition. Vide : le compte propriétaire du script |
| `senderName` | Nom affiché à côté. Vide : le nom de l'événement |

**Une adresse ne s'emprunte pas librement.** Google n'autorise `senderEmail`
que si elle est vérifiée sur le compte qui exécute le script : soit parce que
c'est ce compte, soit parce qu'elle y figure comme alias d'envoi (Gmail →
Paramètres → Comptes → « Envoyer des emails en tant que »).

Pour savoir où vous en êtes, l'espace Super-Admin interroge le script :

```
GET /api/event/mailer
```

Il répond quel compte exécute le script, quelles adresses il peut emprunter,
combien d'envois lui restent aujourd'hui, et si l'adresse configurée convient.
Un envoi d'essai est disponible à côté :

```
POST /api/event/mailer/test   { "to": "vous@exemple.org" }
```

Mieux vaut un essai explicite que de déclencher une réinitialisation sur un
vrai compte pour voir si ça marche.

> Si l'adresse configurée n'est pas autorisée, l'envoi échoue avec un message
> qui nomme le compte et liste les adresses utilisables — plutôt que de partir
> en silence depuis une autre adresse, ce qui vous ferait croire la
> configuration prise en compte.

### Apparence

| Clé | Ce qu'elle fait |
| --- | --- |
| `logoUrl` | Logo affiché sur fond clair. Vide : celui livré avec l'application |
| `logoDarkUrl` | Variante pour fond sombre. Vide : `logoUrl` sert aux deux |
| `primaryColor` | Couleur dominante, en hexadécimal (`#047857`) |
| `accentColor` | Couleur d'accent (`#d97706`) |

Les logos sont des **liens** vers des images accessibles publiquement. Si votre
logo comporte du texte noir, fournissez une variante claire : il disparaîtrait
sur le thème sombre.

### Vocabulaire

C'est ici que l'application cesse de parler de conférences.

| Clé | Par défaut | Pour un stage, par exemple |
| --- | --- | --- |
| `term.session` | session | atelier |
| `term.sessions` | sessions | ateliers |
| `term.checkIn` | émargement | pointage |
| `term.checkIns` | émargements | pointages |
| `term.schedule` | programme | déroulé |
| `term.room` | salle | salle |
| `term.rooms` | salles | salles |
| `term.track` | thématique | module |
| `term.tracks` | thématiques | modules |
| `term.badge` | badge | laissez-passer |
| `term.feedback` | avis | retour |
| `term.feedbacks` | avis | retours |

Le singulier **et** le pluriel sont demandés : le français oblige sinon à des
tournures qui se voient.

### Réglages et listes

| Clé | Valeur |
| --- | --- |
| `allowExpressRegistration` | `oui` / `non` |
| `maintenanceMode` | `oui` / `non` |
| `enableAnonymousFeedback` | `oui` / `non` |
| `autoSyncGoogleSheets` | `oui` / `non` |
| `sessionReminderMinutes` | un nombre, par exemple `15` |
| `rooms` | une liste JSON |
| `tracks` | une liste JSON |
| `docLinks` | une liste JSON |

`oui`, `vrai`, `true`, `1` et `x` valent tous oui. Tout le reste vaut non : un
droit qui n'est pas écrit n'est jamais accordé.

Les trois dernières s'écrivent en JSON, faute de tenir autrement sur une
cellule :

```json
["Robotique", "Éthique", "Langues locales"]
```

```json
[{"id":"s1","name":"Grande salle","capacity":120,"locationNotes":"Rez-de-chaussée","hasStream":true}]
```

> Une accolade oubliée ne vide pas la liste : l'application garde la précédente.
> Une erreur de frappe ne doit pas faire disparaître toutes vos salles.

---

## L'onglet `Rôles`

Une ligne par rôle. C'est cette feuille qui décide de ce que chacun a le droit
de faire.

| Colonne | Contenu |
| --- | --- |
| `ID` | Identifiant stable, écrit dans la colonne « Rôle » de `Participants` |
| `Libellé` | Ce que les gens lisent : `Jury`, `Formateur`, `Exposant` |
| `Espace` | Le tableau de bord réutilisé : `admin`, `organizer`, `speaker`, `volunteer` ou `attendee` |
| `Teinte` | `rouge`, `ambre`, `indigo`, `emeraude`, `violet`, `ardoise`, `ciel`, `rose` |
| `Onglets` | `tous`, ou une liste séparée par des virgules |
| `Scanner` | Valider les présences par QR code |
| `Diffuser` | Publier des annonces à tous |
| `Gérer contenu` | Créer et modifier sessions et personnes |
| `Gérer rôles` | Attribuer les rôles, et modifier cette feuille |
| `Gérer intégrations` | Lier le classeur, lancer les synchronisations |
| `Exporter` | Télécharger les données |
| `Voir tous les avis` | Et pas seulement les siens |
| `Importer` | Charger des données en masse |

Les onglets possibles : `schedule`, `announcements`, `discussions`, `dashboard`,
`networking`, `profile`, `badge`, `ai-guide`.

### Trois garde-fous

**Les six rôles livrés restent toujours présents**, même absents de la feuille.
Leur libellé et leurs droits sont modifiables ; leur identifiant, non. Les
comptes déjà enregistrés le portent, et le changer les laisserait sans rôle.

**Un droit non écrit est refusé**, jamais accordé par défaut. Une cellule vide
n'accorde aucun pouvoir.

**Une feuille où plus personne ne peut gérer les rôles est refusée en bloc.**
L'événement se retrouverait sans moyen de se corriger. Les rôles livrés
reprennent alors, et le serveur le dit au démarrage.

### Un exemple

Un stage de secourisme n'a ni conférenciers ni sponsors. Il a des formateurs,
des stagiaires et un jury :

| ID | Libellé | Espace | Teinte | Onglets | Scanner | Gérer rôles |
| --- | --- | --- | --- | --- | --- | --- |
| `super-admin` | Direction | admin | rouge | tous | oui | **oui** |
| `formateur` | Formateur | speaker | indigo | tous | oui | non |
| `jury` | Jury | speaker | rose | schedule, profile, badge | non | non |
| `attendee` | Stagiaire | attendee | ardoise | tous | non | non |

Les rôles livrés que vous n'employez pas restent définis mais ne gênent
personne : il suffit de ne les attribuer à personne.

---

## Depuis l'application

Vous n'êtes pas obligé de passer par le classeur.

- **Super-Admin → Rôles de l'événement** définit les rôles : libellé, espace,
  teinte, onglets, droits, création et suppression. L'écran refuse d'enregistrer
  une table sans gestionnaire de rôles, et signale pourquoi.
- **Super-Admin → Paramètres généraux** modifie l'identité, les salles, les
  thématiques et les documents publiés.

Ce que vous y enregistrez part dans le classeur. L'écran attend le verdict avant
de dire « enregistré » — et si l'écriture échoue, il rétablit ce qu'il affichait
plutôt que de vous montrer une chose que le classeur ne contient pas.

> Pour écrire dans le classeur, une voie d'écriture doit être configurée : l'URL
> d'un Apps Script Web App, ou des identifiants AppSheet. Voir
> [DEPLOIEMENT-RENDER.md](DEPLOIEMENT-RENDER.md). Sans elle, la lecture
> fonctionne mais tout enregistrement échoue avec un message explicite.

Une modification faite **à la main dans le classeur** n'est pas vue tout de
suite : le serveur garde la configuration en mémoire. Le bouton de relecture de
l'espace Super-Admin la reprend sans redémarrer le service.

---

## Installer un nouvel événement

1. Dupliquez le modèle de classeur (voir [MODELE-CLASSEUR.md](MODELE-CLASSEUR.md))
   et partagez-le en lecture avec « Tous les utilisateurs disposant du lien ».
2. Déployez l'Apps Script dessus, et notez son URL.
3. Déployez l'application avec `SHEET_URL` et `APPS_SCRIPT_URL`.
4. Remplissez l'onglet `Configuration` : au minimum `eventName` et les dates.
5. Remplissez `Rôles` si les six rôles livrés ne conviennent pas.
6. Remplissez `Participants` : une ligne par personne, avec son email et son
   rôle. Chacun choisira son mot de passe à sa première connexion.

Une installation sert **un événement**. Pour en gérer plusieurs, déployez-en
autant, chacun avec son classeur : les données restent ainsi séparées sans que
personne ait à y veiller.
