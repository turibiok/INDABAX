# Déployer sur Vercel avec Neon

Vercel n'exécute pas un serveur qui tourne : il réveille une fonction à chaque
requête, et peut en réveiller plusieurs en parallèle. Une même personne peut
donc voir ses requêtes traitées par des copies différentes, dont aucune ne se
souvient de ce qu'une autre a fait.

Cela a une conséquence qui dépasse le déploiement, et qu'il faut avoir en tête.

---

## Ce que le passage à Vercel a changé dans le code

**Les sessions vivent en base.** Elles vivaient dans une table en mémoire, ce
qui suppose un serveur unique et durable. Sur Vercel, une requête aurait pu
atterrir sur une copie n'ayant jamais vu la session : la personne se serait
retrouvée déconnectée au hasard, sans rien pour l'expliquer.

**Les jetons de réinitialisation aussi.** Un lien émis par une copie doit être
reconnu par les autres, sinon « mot de passe oublié » échoue une fois sur deux.

Ces deux corrections valent aussi ailleurs : elles rendent le service correct
dès qu'il tourne en plusieurs exemplaires, ce qui arrive sur n'importe quel
hébergeur dès qu'on monte en charge.

> Sans `DATABASE_URL`, les sessions restent en mémoire. C'est acceptable pour
> une installation mono-événement sur un seul serveur, et **inutilisable sur
> Vercel** : la base n'y est pas optionnelle.

---

## 1. La base, chez Neon

1. [neon.tech](https://neon.tech) → nouveau projet
2. Choisissez la région la plus proche de celle de votre déploiement Vercel
3. Copiez la chaîne **Pooled connection** — son hôte contient `-pooler`

L'adresse directe ouvre une connexion par requête et s'épuise dès que plusieurs
personnes arrivent ensemble. Sur Vercel, où chaque requête peut réveiller une
fonction distincte, c'est une certitude et non un risque. Le serveur le signale
au démarrage s'il reconnaît la mauvaise.

---

## 2. Le déploiement

Vercel → *Add New Project* → importez ce dépôt. `vercel.json` décrit déjà tout :
la construction, le dossier servi, et le renvoi des requêtes `/api/*` vers la
fonction.

### Variables à renseigner

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | L'adresse Neon *pooled* |
| `PLATFORM_ADMIN_EMAIL` | Votre compte d'administration, créé au premier démarrage |
| `PLATFORM_ADMIN_PASSWORD` | Son mot de passe, 8 caractères au moins |
| `SHEET_URL` | Le classeur, si un événement en garde un |
| `APPS_SCRIPT_URL` | L'Apps Script de ce classeur |
| `FEDAPAY_SECRET_KEY` | Clé secrète FedaPay |
| `FEDAPAY_WEBHOOK_SECRET` | Secret des notifications — **différent de la clé secrète** |
| `APP_URL` | L'adresse publique, pour les retours de paiement |
| `GEMINI_API_KEY` | L'assistant. Sans elle, seul cet onglet manque |

Les tables sont créées au premier démarrage. Rien à lancer.

---

## Ce qui ne fonctionne pas pareil

**Le disque est en lecture seule.** L'état serveur (`.data/server-state.json`)
ne peut pas y être écrit. Ce n'est pas bloquant : l'écriture échoue en le
signalant, et tout ce qui compte vit en base ou dans le classeur. Mais une
installation qui s'appuyait sur ce fichier pour survivre à un redémarrage doit
passer par `DATABASE_URL`.

**Les purges périodiques ne s'exécutent pas.** Le processus ne vit pas assez
longtemps pour qu'un intervalle se déclenche. Sans effet : une session périmée
est effacée au moment où on essaie de la lire.

**Le premier appel après une accalmie est lent.** Neon endort une base inactive
et la réveille en quelques secondes ; Vercel réveille aussi sa fonction. Le
délai de connexion est porté à trente secondes pour cette raison.

---

## Notifications de paiement

Dans FedaPay, déclarez l'URL : `https://votre-domaine.vercel.app/api/paiement/webhook`

Cette route lit le corps brut, sans passer par l'analyse JSON : la signature
porte sur le texte exact envoyé, et le ré-encoder en changerait l'empreinte.
