# Déploiement — IndabaX Bénin 2026

L'application est un serveur Node unique : il sert le front compilé et l'API sur le même port, donc la même origine. Aucune base de données à installer, aucun projet Google Cloud, aucun Firebase.

## 1. Prérequis

- Node.js 20 ou plus récent
- Un classeur Google Sheet partagé en lecture avec « Tous les utilisateurs disposant du lien » (voir [MODELE-CLASSEUR.md](MODELE-CLASSEUR.md))
- De préférence un nom de domaine en HTTPS (voir §5)

## 2. Configuration

Copiez `.env.example` en `.env` et renseignez au minimum le compte Super-Admin :

```bash
cp .env.example .env
```

| Variable | Rôle |
| --- | --- |
| `SUPERADMIN_EMAIL` | Compte Super-Admin, créé au premier démarrage s'il n'existe pas |
| `SUPERADMIN_PASSWORD` | Son mot de passe initial |
| `SUPERADMIN_NAME` | Nom affiché (optionnel) |
| `ADMIN_EMAILS` | Accès de secours si la table des comptes est vide (optionnel) |
| `ADMIN_PASSWORD` | Mot de passe de cet accès de secours |
| `GEMINI_API_KEY` | Assistant IA. Sans clé, seul l'onglet « Guide IA » est indisponible |
| `PORT` | Port d'écoute, 3000 par défaut |
| `COOKIE_SECURE` | Forcer ou lever le drapeau `Secure` du cookie (voir §5) |

Le provisionnement du Super-Admin est **idempotent** : au redémarrage, un compte déjà présent n'est jamais réécrit. Un mot de passe changé depuis l'application est donc conservé.

`.env` n'est pas versionné. Ne le committez pas et ne le partagez pas.

## 3. Construction et démarrage

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

`npm run build` produit :

- `dist/` — le front compilé (HTML, CSS, JS)
- `dist/server.cjs` — le serveur, dépendances externes non incluses

`npm start` lance `node dist/server.cjs`. `NODE_ENV=production` est important : il désactive Vite, désactive l'amorçage des comptes de démonstration et active le drapeau `Secure` du cookie.

Au démarrage, le serveur résume sa configuration :

```
Compte Super-Admin créé : vous@exemple.bj
Cookie de session : HttpOnly + Secure (HTTPS requis).
Aucun classeur lié : connectez-vous puis renseignez le lien dans l'espace Super-Admin.
IndabaX Bénin Event App à l'écoute sur le port 3000
```

Lisez ces lignes : elles disent exactement ce qui manque.

## 4. Données à conserver entre deux déploiements

Le dossier **`.data/`** contient l'état du serveur : lien du classeur, noms d'onglets, secrets d'écriture (URL Apps Script, clé AppSheet) et table des comptes avec les empreintes de mots de passe.

Il est exclu du dépôt. **Montez-le sur un volume persistant** ou sauvegardez-le : le perdre revient à reconfigurer l'application et à réinitialiser les mots de passe qui ont été changés depuis l'interface.

Les **sessions** sont en mémoire : un redémarrage déconnecte tout le monde. La configuration, elle, survit.

## 5. HTTPS et cookie de session

En production, le cookie de session porte le drapeau `Secure` : le navigateur ne le renvoie **que** sur HTTPS. Servi en HTTP simple, la connexion échoue silencieusement — le cookie est posé puis jamais retourné.

Deux options :

- **Recommandé** — placez un reverse proxy TLS devant l'application (Caddy, Nginx, ou la terminaison TLS de votre hébergeur). Le drapeau reste actif.
- **Mise en service provisoire en HTTP** — mettez `COOKIE_SECURE="false"` dans `.env`. Le serveur affiche alors un avertissement au démarrage. À ne pas laisser en place pour l'événement.

Exemple minimal avec Caddy, qui obtient le certificat tout seul :

```
indabax.exemple.bj {
    reverse_proxy localhost:3000
}
```

L'application appelle `app.set("trust proxy", 1)` : derrière un proxy, l'IP réelle du client est utilisée pour la limitation des tentatives de connexion.

## 6. Première mise en route

1. Ouvrez l'application et connectez-vous avec `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.
2. Menu du compte → **Base Google Sheet** → onglet **Modèles des feuilles** : téléchargez les cinq CSV et créez les onglets correspondants dans votre classeur.
3. Onglet **Classeur & rôles** : collez le lien du classeur, puis **Tester et lier le classeur**. Le message indique combien de comptes ont été détectés.
4. Onglet **Écriture** : pour que les émargements et les feedbacks remontent dans le classeur, collez le script Apps Script fourni dans le classeur (*Extensions › Apps Script*), déployez-le en **Application web** accessible à tout le monde, et collez son URL. Ou renseignez l'App ID et la clé de l'API AppSheet.
5. Espace **Super-Admin → Rôles & accès** : attribuez les rôles. Chaque compte a besoin d'un mot de passe ; vous pouvez en faire générer un, il s'affiche une seule fois.
6. Changez le mot de passe du Super-Admin depuis le menu du compte, pour qu'il ne reste pas celui inscrit dans `.env`.

## 7. Vérifications après déploiement

```bash
curl -s https://votre-domaine/api/health
```

Réponse attendue :

```json
{"status":"ok","time":"…","event":"IndabaX Bénin 2026","openSessions":0}
```

Puis, dans l'application : connectez-vous, ouvrez l'espace Super-Admin, vérifiez que la liste des comptes s'affiche. Si la connexion « ne fait rien », le cookie `Secure` sur une origine HTTP est la cause la plus probable (§5).

## 8. Rappel du modèle de sécurité

- L'autorisation est décidée **côté serveur** à chaque requête, à partir du rôle de la session. Le navigateur ne fait que construire l'interface.
- Le cookie de session est `HttpOnly` : il est invisible au JavaScript de la page et ne contient qu'un identifiant opaque.
- Les mots de passe sont conservés en empreinte scrypt salée, jamais en clair.
- Le lien du classeur et les secrets d'écriture ne descendent jamais dans le navigateur.
- Le client ne fournit jamais d'URL sortante : il nomme une catégorie de données, le serveur choisit l'onglet. Les appels sortants sont restreints aux hôtes Google.
- Aucun mot de passe en clair ne figure dans le classeur : chacun choisit le sien en s'inscrivant, et l'onglet `Participants` n'en garde qu'une empreinte scrypt, dans la colonne `Empreinte`. Cette colonne est écrite par le serveur ; ne la recopiez pas d'une ligne à l'autre.
