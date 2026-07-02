# 🔑 Sésame — Comptes & habilitations

Outil web interne de gestion des **entrées / sorties / modifications de comptes** pour une
collectivité territoriale : demandes avec circuits de validation paramétrables (par service,
par groupe AD…), alertes mail, suivi des accès aux applications métiers, annuaire Active
Directory en lecture (LDAPS), interconnexion avec le catalogue d'applications
[Sentinelle](https://github.com/cparfait/sentinelle).

**Stack** : Next.js 16 (TypeScript) · PostgreSQL · Prisma · Tailwind CSS · Docker.

## Fonctionnalités

- **Demandes** : création / modification / départ d'agent, fiches complètes adaptées à une
  collectivité (statut d'emploi, direction/service, matricule, télétravail, dates de contrat…)
- **Circuits de validation multiples** : autant de circuits que nécessaire par type de
  demande, rattachés par critères (service concerné, groupe AD du demandeur), circuit par
  défaut, notifications mail à chaque étape, refus motivé
- **Provisionnement** : checklist générée à l'approbation (AD, messagerie, VPN/télétravail,
  applications, matériel), clôture automatique quand tout est fait
- **Vue demandeur** : les agents au rôle « Demandeur » ne voient que leurs demandes
  (dépôt + suivi), sans accès au reste de l'outil
- **Référentiel** : agents, applications métiers (profils d'accès), accès attribués/supprimés
  avec historique — applications importables depuis Sentinelle
- **Annuaire AD** : synchronisation LDAPS **en lecture seule**, rapprochement automatique
  agents ↔ comptes, alertes « compte encore actif pour un agent parti »
- **Rôles** : Administrateur, Valideur, Technicien, Demandeur, Lecteur
- **Journal d'audit** complet

---

## 1. Prérequis

| Usage | Outils nécessaires |
|---|---|
| Développement | [Git](https://git-scm.com/), [Node.js 22+](https://nodejs.org/) (avec npm), [Docker](https://www.docker.com/) (pour la base PostgreSQL) |
| Production | Docker + Portainer (ou docker compose), un PostgreSQL 15+ (fourni par la stack) |

## 2. Récupérer le projet

```bash
git clone https://github.com/cparfait/sesame.git
cd sesame
```

## 3. Installation en développement

```bash
# 1. Dépendances
npm install

# 2. Configuration : copier l'exemple puis ajuster si besoin
cp .env.example .env

# 3. Base PostgreSQL locale (port 5433 pour ne pas gêner un Postgres existant)
docker run -d --name sesame-db-dev \
  -e POSTGRES_USER=sesame -e POSTGRES_PASSWORD=sesame -e POSTGRES_DB=sesame \
  -p 5433:5432 postgres:17-alpine

# 4. Création des tables
npx prisma migrate dev

# 5. Lancement
npm run dev
```

L'application est disponible sur **http://localhost:3000**.

> Au redémarrage du poste, relancer simplement la base : `docker start sesame-db-dev`.

## 4. Première connexion

- **Compte admin local de secours** : identifiant `admin`, mot de passe défini par la
  variable `SESAME_ADMIN_PASSWORD` du `.env` (défaut : `sesame`). Il est créé
  automatiquement au premier essai de connexion tant qu'aucun administrateur actif
  n'existe. **Changez ce mot de passe immédiatement en production**
  (Paramètres → Utilisateurs & rôles → icône clé).
- **Comptes AD** : une fois le LDAPS configuré (Paramètres → Annuaire AD), les agents se
  connectent avec leur identifiant Windows ; leur compte Sésame est créé à la volée avec
  le rôle par défaut choisi (Demandeur ou Lecteur).

## 5. Installation en production (Docker / Portainer)

Le dépôt contient tout le nécessaire : [Dockerfile](Dockerfile) (image unique, migrations
appliquées automatiquement au démarrage) et [docker-compose.yml](docker-compose.yml)
(application + PostgreSQL avec volume persistant).

### Option A — Stack Portainer depuis le dépôt Git (recommandé)

1. Portainer → **Stacks** → **Add stack** → **Repository**
2. Repository URL : `https://github.com/cparfait/sesame` — Compose path : `docker-compose.yml`
3. Renseigner les variables d'environnement :

| Variable | Rôle |
|---|---|
| `POSTGRES_PASSWORD` | mot de passe de la base (obligatoire) |
| `SESSION_SECRET` | chaîne aléatoire de 32+ caractères (obligatoire) |
| `SESAME_ADMIN_PASSWORD` | mot de passe initial du compte `admin` |
| `COOKIE_SECURE=0` | uniquement si l'accès se fait en HTTP sans reverse proxy TLS |

4. **Deploy the stack** — l'application écoute sur le port `3000` ; placez votre reverse
   proxy TLS habituel devant (ex. `sesame.votre-collectivite.fr`).

### Option B — En ligne de commande sur le serveur Docker

```bash
git clone https://github.com/cparfait/sesame.git && cd sesame
POSTGRES_PASSWORD='UnMotDePasseSolide' \
SESSION_SECRET='UneChaineAleatoireDe32CaracteresMinimum' \
SESAME_ADMIN_PASSWORD='AutreMotDePasse' \
docker compose up -d --build
```

Les migrations de base sont appliquées automatiquement à chaque démarrage du conteneur
([docker-entrypoint.sh](docker-entrypoint.sh)) : aucune commande manuelle.

## 6. Configuration dans l'interface (menu Paramètres, rôle Administrateur)

1. **Général** : nom de la collectivité, URL publique (utilisée dans les liens des mails)
2. **Annuaire AD (LDAPS)** : URL `ldaps://…`, DN de base, compte de service en lecture
   seule, test de connexion, synchronisation de l'annuaire
3. **Messagerie (SMTP)** : serveur, expéditeur, mail de test
4. **Sentinelle** : URL + jeton pour importer le catalogue d'applications — le blueprint
   Flask à installer côté Sentinelle est fourni dans [docs/sentinelle_api.py](docs/sentinelle_api.py)
5. **Circuits de validation** : circuits par type de demande, critères service / groupe AD
6. **Utilisateurs & rôles** : attribution des rôles, comptes locaux d'appoint

## 7. Mettre à jour

```bash
# Développement
git pull && npm install && npx prisma migrate dev && npm run dev

# Production (Portainer) : Stacks → sesame → « Pull and redeploy »
# Production (CLI) :
git pull && docker compose up -d --build
```

---

Voir [SUIVI_PROJET.md](SUIVI_PROJET.md) pour l'avancement et la feuille de route (v2 :
écriture AD via LSC, revues d'habilitations, rappels automatiques), et
[docs/ETUDE_OUTILS_EXISTANTS.md](docs/ETUDE_OUTILS_EXISTANTS.md) pour l'étude comparative
des outils open-source du domaine.
