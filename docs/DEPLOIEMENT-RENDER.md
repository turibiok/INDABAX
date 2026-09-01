# Déploiement sur Render

Render exécute un vrai processus Node en continu, ce que l'application suppose : sessions en mémoire, état sur disque, `app.listen()`. Aucune modification de code n'est nécessaire.

> **Pourquoi pas Vercel.** Vercel est *serverless* : chaque requête peut atterrir sur une instance différente, et le disque est en lecture seule. Les sessions (un `Map` en mémoire) seraient perdues aussitôt après la connexion, et `.data/server-state.json` ne pourrait pas être écrit. Un déploiement Vercel demanderait de remplacer les sessions par un cookie signé sans état et le fichier d'état par un service externe.

## Service en place

Un service est déjà déployé pour ce projet :

| | |
| --- | --- |
| **Nom** | `indabax-benin` |
| **URL** | https://indabax-benin.onrender.com |
| **Région** | Frankfurt |
| **Plan** | Free |
| **Branche suivie** | `master`, déploiement automatique à chaque push |

Les sections ci-dessous servent à le recréer ou à le reconfigurer.

## 1. Créer le service

Sur [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service** → connectez le dépôt GitHub.

| Réglage | Valeur |
| --- | --- |
| **Language** | `Node` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

Le projet est à la racine du dépôt : laissez **Root Directory** vide.

Render fournit lui-même la variable `PORT` ; le serveur la lit et n'a rien à configurer de ce côté.

## 2. Variables d'environnement

Onglet **Environment** du service. Ces valeurs remplacent le fichier `.env`, qui n'est pas dans le dépôt — et ne doit pas y être.

### Indispensables

| Variable | Valeur |
| --- | --- |
| `NODE_ENV` | `production` |
| `SUPERADMIN_EMAIL` | votre email |
| `SUPERADMIN_PASSWORD` | votre mot de passe |
| `SUPERADMIN_NAME` | votre nom affiché |

### Recommandées

| Variable | Rôle |
| --- | --- |
| `SHEET_URL` | Lien du classeur Google Sheet. Le serveur le vérifie au démarrage et charge les comptes tout seul. |
| `GEMINI_API_KEY` | Assistant IA. Sans clé, seul l'onglet « Guide IA » est indisponible. |
| `APPS_SCRIPT_URL` | URL du Apps Script Web App, pour que les émargements et feedbacks remontent dans le classeur. |

### Optionnelles

| Variable | Rôle |
| --- | --- |
| `SHEET_PROFILES_TAB`, `SHEET_SESSIONS_TAB`, `SHEET_CHECKINS_TAB`, `SHEET_FEEDBACKS_TAB`, `SHEET_ANNOUNCEMENTS_TAB`, `SHEET_MESSAGES_TAB` | Noms d'onglets, si vous n'utilisez pas ceux par défaut. `SHEET_USERS_TAB` et `SHEET_PARTICIPANTS_TAB` restent acceptés à la place du premier |
| `APPSHEET_APP_ID`, `APPSHEET_ACCESS_KEY` | Écriture via l'API AppSheet au lieu du Apps Script |
| `ADMIN_EMAILS`, `ADMIN_PASSWORD` | Accès de secours si la table des comptes est vide. **Déconseillé en production** : ce compte n'est pas enregistré en base, donc son mot de passe n'est pas modifiable depuis l'application et reste figé dans la configuration. Le compte `SUPERADMIN_*`, lui, est un vrai compte : préférez-le seul, et n'ajoutez ces deux variables que si vous vous retrouvez enfermé dehors. |

Ces variables ne servent qu'à **initialiser** : une valeur déjà enregistrée par l'application n'est jamais écrasée au redémarrage. Vous pouvez donc modifier la configuration depuis l'interface sans qu'un redéploiement la remette en arrière.

Render **ne** définit **pas** `COOKIE_SECURE` : ne le touchez pas. Render sert en HTTPS, donc le drapeau `Secure` du cookie doit rester actif.

## 3. Vérifier le démarrage

Onglet **Logs**. Vous devez lire, dans cet ordre :

```
État serveur chargé : classeur non lié, 0 compte(s) dans la table du serveur.
Configuration du classeur appliquée depuis l'environnement : masterSheetUrl.
Compte Super-Admin créé : vous@exemple.bj
Cookie de session : HttpOnly + Secure (HTTPS requis).
Classeur Google Sheet lié : 12 compte(s) chargé(s) depuis l'onglet « Participants ».
IndabaX Bénin Event App à l'écoute sur le port 10000
```

Ces lignes disent exactement ce qui manque. Puis :

```bash
curl -s https://votre-service.onrender.com/api/health
```

## 4. Le niveau gratuit, et ses conséquences

Le plan **Free** convient pour tester, mais deux limites comptent le jour de l'événement :

- **Mise en veille après 15 minutes d'inactivité.** Le premier accès suivant prend ~30 secondes, et les **sessions ouvertes sont perdues** (elles vivent en mémoire) : les utilisateurs doivent se reconnecter. La configuration, elle, est retrouvée grâce aux variables d'environnement.
- **Pas de disque persistant.** `.data/` est réinitialisé à chaque redéploiement ou réveil. Conséquence : les mots de passe changés depuis l'application, et les rôles attribués sans voie d'écriture vers le classeur, sont perdus.

Pour un usage réel pendant l'événement, deux protections :

1. **Passez le service en plan payant** (à partir de ~7 $/mois) : pas de mise en veille, et un disque persistant peut être monté sur `.data/`.
2. **Faites du classeur Google Sheet la source de vérité** : renseignez `SHEET_URL` et une voie d'écriture (`APPS_SCRIPT_URL`). Les rôles et mots de passe vivent alors dans le classeur, et une réinitialisation du disque ne perd plus rien d'important.

La seconde protection est de toute façon la bonne pratique : c'est le sens même de l'architecture de cette application.

## 5. Monter un disque persistant (plan payant)

Onglet **Disks** → **Add Disk** :

| Réglage | Valeur |
| --- | --- |
| **Name** | `indabax-data` |
| **Mount Path** | `/opt/render/project/src/.data` |
| **Size** | 1 GB |

Le chemin de montage doit correspondre à `.data/` **relativement au répertoire de travail du service**. Vérifiez-le dans les logs au premier démarrage : si l'application signale qu'elle ne peut pas écrire son état, c'est ce chemin qu'il faut corriger.

## 6. Après le premier déploiement

1. Ouvrez l'URL du service, connectez-vous avec `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.
2. Si vous n'avez pas renseigné `SHEET_URL` : **Base Google Sheet → Classeur & rôles**, collez le lien, puis « Tester et lier ».
3. **Écriture** : déployez le Apps Script fourni et collez son URL, pour que les émargements remontent.
4. **Rôles & accès** : attribuez les rôles aux emails.
5. Changez le mot de passe du Super-Admin depuis le menu du compte.

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md) pour le détail des variables et du modèle de sécurité, et [MODELE-CLASSEUR.md](MODELE-CLASSEUR.md) pour la structure du classeur.
