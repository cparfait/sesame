# 🔑 Sésame — Comptes & habilitations

Outil web interne de gestion des **entrées / sorties / modifications de comptes** pour une
collectivité territoriale : demandes avec circuit de validation paramétrable, alertes mail,
suivi des accès aux applications métiers, annuaire Active Directory en lecture (LDAPS).

**Stack** : Next.js 16 (TypeScript) · PostgreSQL · Prisma · Tailwind CSS · Docker.

## Fonctionnalités

- **Demandes** : création / modification / départ d'agent, fiches complètes adaptées à une
  collectivité (statut d'emploi, direction/service, matricule, dates de contrat…)
- **Workflows paramétrables** : étapes ordonnées par type de demande, valideurs par rôle ou
  nommés, notifications mail à chaque étape, refus motivé
- **Provisionnement** : checklist générée à l'approbation (AD, messagerie, applications,
  matériel), clôture automatique quand tout est fait
- **Référentiel** : agents, applications métiers (profils d'accès), accès attribués/supprimés
  avec historique
- **Annuaire AD** : synchronisation LDAPS **en lecture seule**, rapprochement automatique
  agents ↔ comptes, alertes « compte encore actif pour un agent parti »
- **Rôles** : Administrateur, Valideur, Technicien, Demandeur, Lecteur
- **Journal d'audit** complet

## Démarrage rapide (développement)

```bash
docker run -d --name sesame-db-dev -e POSTGRES_USER=sesame -e POSTGRES_PASSWORD=sesame \
  -e POSTGRES_DB=sesame -p 5433:5432 postgres:17-alpine
npm install
npx prisma migrate dev
npm run dev
```

## Connexion

- **Compte admin local de secours** : identifiant `admin`, mot de passe défini par la
  variable `SESAME_ADMIN_PASSWORD` (défaut : `sesame`). Il est créé automatiquement au
  premier essai de connexion tant qu'aucun administrateur actif n'existe.
  **Changez ce mot de passe immédiatement en production.**
- **Comptes AD** : une fois le LDAPS configuré (Paramètres → Annuaire AD), les agents se
  connectent avec leur identifiant Windows ; leur compte Sésame est créé à la volée avec le
  rôle par défaut choisi.

## Déploiement (Docker / Portainer)

Le [docker-compose.yml](docker-compose.yml) fournit une stack complète (app + PostgreSQL).
Variables à définir dans Portainer :

| Variable | Rôle |
|---|---|
| `POSTGRES_PASSWORD` | mot de passe de la base (obligatoire) |
| `SESSION_SECRET` | chaîne aléatoire de 32+ caractères (obligatoire) |
| `SESAME_ADMIN_PASSWORD` | mot de passe initial du compte `admin` |
| `COOKIE_SECURE=0` | uniquement si l'accès se fait en HTTP sans reverse proxy TLS |

Les migrations de base sont appliquées automatiquement au démarrage du conteneur
([docker-entrypoint.sh](docker-entrypoint.sh)).

## Configuration dans l'interface (menu Paramètres, rôle Administrateur)

1. **Général** : nom de la collectivité, URL publique (liens dans les mails)
2. **Annuaire AD** : URL `ldaps://…`, DN de base, compte de service lecture seule, test de
   connexion, synchronisation
3. **Messagerie** : serveur SMTP, mail de test
4. **Circuits de validation** : étapes par type de demande
5. **Utilisateurs & rôles** : attribution des rôles, comptes locaux d'appoint

Voir [SUIVI_PROJET.md](SUIVI_PROJET.md) pour l'avancement et la feuille de route (v2 :
écriture AD, revues d'habilitations, rappels automatiques).
