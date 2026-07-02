# Sésame — Suivi de projet

> Gestion des comptes et des habilitations pour la collectivité
> Entrées / sorties / modifications d'agents, suivi des accès applicatifs, workflows de validation.

## Informations générales

| | |
|---|---|
| **Nom** | Sésame |
| **Objectif** | Tracer les demandes de création / modification / suppression de comptes, suivre les accès aux applications métiers, fiabiliser les départs |
| **Stack** | Next.js 16 (TypeScript, App Router) · PostgreSQL · Prisma · Tailwind CSS |
| **Hébergement** | Docker (image unique + PostgreSQL) via Portainer |
| **Authentification** | Comptes AD via LDAPS + compte admin local de secours |
| **Démarrage** | 01/07/2026 |

## Décisions actées

| Date | Décision |
|---|---|
| 01/07/2026 | Stack Next.js + PostgreSQL (monolithe, une image Docker) |
| 01/07/2026 | AD en **lecture seule** en v1 (rapprochement + détection) ; écriture LDAPS visée en v2 |
| 01/07/2026 | Connexion des utilisateurs via LDAPS avec leurs identifiants Windows |
| 01/07/2026 | Nom retenu : **Sésame** |
| 01/07/2026 | Aucune donnée de démonstration : la base démarre vide, alimentée par l'usage et la synchro AD |

## Périmètre v1

- [x] Référentiel **agents** (fiche complète adaptée collectivité : statut d'emploi, direction/service, matricule, dates…)
- [x] Référentiel **applications métiers** (référent, profils d'accès)
- [x] Suivi des **accès** agent ↔ application (attribution, suppression, historique)
- [x] **Demandes** : création / modification / départ, avec fiches complètes
- [x] **Workflow paramétrable** par type de demande (étapes ordonnées, valideurs par rôle ou nommés)
- [x] **Alertes mail** (SMTP) : besoin de validation, décision rendue, provisionnement à faire
- [x] **Checklist de provisionnement** générée à l'approbation (AD, messagerie, applications, matériel)
- [x] **Annuaire AD** : synchronisation LDAPS lecture seule, rapprochement agents ↔ comptes, alertes (compte actif d'un agent parti, comptes orphelins)
- [x] **Rôles** : Admin, Valideur, Technicien, Demandeur, Lecteur
- [x] **Journal d'audit**
- [x] Paramétrage dans l'interface : Général, LDAP, SMTP, workflows, utilisateurs
- [x] **Compte admin local de secours** (`admin` / variable `SESAME_ADMIN_PASSWORD`, créé automatiquement au premier démarrage)
- [x] Dockerfile + docker-compose pour Portainer (migrations automatiques au démarrage)

### Évolutions livrées le 02/07/2026 (v1.1)

- [x] **Circuits de validation multiples** : autant de circuits que nécessaire par type (un par service, direction…), rattachés par critères — service de la demande et/ou **groupe AD du demandeur** (autocomplétion depuis la synchro AD) — avec circuit par défaut et priorités
- [x] **Vue demandeur simplifiée** : un agent au rôle Demandeur ne voit que « Tableau de bord » et « Mes demandes » (dépôt + suivi de ses propres demandes) ; les autres pages lui sont fermées
- [x] **Section télétravail** dans les demandes de création et de modification (rythme hebdomadaire) ; génère automatiquement la tâche « ouvrir l'accès télétravail (VPN, MFA) » ; champ visible sur la fiche agent ; le départ ferme les accès distants
- [x] **Interconnexion Sentinelle** : import du catalogue d'applications (modèle Asset) via API + jeton, badge « Sentinelle » sur les applications importées, désactivation automatique des applications retirées du catalogue — blueprint Flask prêt à coller fourni dans `docs/sentinelle_api.py`
- [x] Étude comparative des outils open-source existants : `docs/ETUDE_OUTILS_EXISTANTS.md` (36 outils recensés, 10 vérifiés)

### Reste à faire avant mise en production

- [ ] Configurer le LDAPS avec le vrai AD et tester (compte de service en lecture seule à créer)
- [ ] Configurer le SMTP de la collectivité et vérifier les notifications
- [ ] Paramétrer les circuits de validation réels (qui valide quoi)
- [ ] Saisir le référentiel des applications métiers
- [ ] Changer le mot de passe du compte `admin`
- [ ] Mettre en place le reverse proxy TLS + nom de domaine interne

## Périmètre v2 (à planifier)

- Écriture AD via LDAPS (création / désactivation de comptes, gestion des groupes)
- Campagnes de revue des habilitations (recertification périodique)
- Rappels automatiques (fins de contrat approchantes, tâches en retard)
- Export CSV / rapports pour audits (RGPD, chambre régionale des comptes)

## Journal d'avancement

| Date | Avancement |
|---|---|
| 01/07/2026 | Cadrage, choix de stack, squelette du projet créé |
| 01/07/2026 | Déplacement du projet vers `C:\tmp\__DEV__\workflow` ; lancement d'une étude des outils open-source existants (GitHub) pour s'en inspirer |
| 02/07/2026 | Développement v1 complet : demandes, workflows, mails, annuaire AD, paramétrage, Docker. Compilation OK |
| 02/07/2026 | Test de bout en bout validé en local : connexion admin local → création d'application → demande de création → approbation → checklist 5 tâches → clôture automatique → agent créé au référentiel avec son accès |
| 02/07/2026 | Premier push sur https://github.com/cparfait/sesame |
| 02/07/2026 | v1.1 : circuits multiples (service / groupe AD), vue demandeur, télétravail, interconnexion Sentinelle. Testé de bout en bout : circuit par défaut appliqué → validation requise → tâche VPN télétravail générée ; vue demandeur vérifiée (menu réduit, pages restreintes bloquées) |

## Risques & points d'attention

- **Compte de service LDAP** : prévoir un compte en lecture seule dédié, mot de passe stocké en base — restreindre l'accès à la page Paramètres aux admins.
- **Certificat LDAPS** : si AC interne, importer l'AC dans le conteneur ou utiliser l'option « ne pas vérifier le certificat » (à éviter en production).
- **RGPD** : le référentiel contient des données RH ; prévoir l'inscription au registre des traitements et une durée de conservation.
- **Compte admin local** : changer le mot de passe par défaut dès la première connexion.
