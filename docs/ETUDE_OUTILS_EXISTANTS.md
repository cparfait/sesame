# Sésame — Synthèse de la veille GitHub : outils existants, remplacement possible, idées à reprendre

> Étude réalisée le 02/07/2026 : 36 outils open-source recensés sur 4 angles
> (plateformes IGA, écosystème français / secteur public, gestionnaires LDAP/AD,
> outils de demandes d'accès et d'on/offboarding), les 10 fiches les plus
> prometteuses vérifiées une à une sur leurs dépôts GitHub réels.

## 1. Les 10 outils les plus pertinents

| Outil | Catégorie | Activité | Licence | Verdict en une phrase |
|---|---|---|---|---|
| [midPoint (Evolveum)](https://github.com/Evolveum/midpoint) | IGA complet | Très actif (branche 4.11, juillet 2026, ~46 400 commits) | EUPL-1.2 | Le vrai IGA open-source de référence, mais plateforme Java surdimensionnée pour une collectivité ; la meilleure source d'inspiration conceptuelle de la liste. |
| [Apache Syncope](https://github.com/apache/syncope) | IGA complet | Actif (release 4.1.1, mai 2026) | Apache-2.0 | Techniquement capable de tout faire, mais la configuration (BPMN Flowable, Java, consoles génériques anglophones) coûterait plus cher que développer Sésame. |
| [Keycloak](https://github.com/keycloak/keycloak) | IdP/SSO | Très actif (26.6.4, juin 2026, ~35,5k étoiles, CNCF) | Apache-2.0 | Ne fait pas d'IGA, mais c'est la brique SSO naturelle de Sésame (SILL, ProConnect, thème DSFR maintenu `codegouvfr/keycloak-theme-dsfr`) et le modèle de référence pour l'écran de fédération LDAP/AD. |
| [FusionDirectory](https://github.com/fusiondirectory/fusiondirectory) | Gestion LDAP | Développement actif (commits juillet 2026) mais versions espacées (~1 tous les 1-2 ans) | GPL-2.0 | Gère l'annuaire OpenLDAP en écriture avec triggers arrivée/départ, mais ni workflow de demandes ni suivi des applis métiers ; brique v2 possible, pas un remplaçant. |
| [LSC](https://github.com/lsc-project/lsc) | Synchro LDAP/AD | Actif (2.2.2 janv. 2026, commits juillet 2026, financé NLnet) | BSD | Aucune IHM, mais LE moteur français éprouvé de synchro AD↔base — candidat idéal pour le provisioning v2 de Sésame sans réinventer les subtilités AD. |
| [GLPI + Resources + FormCreator](https://github.com/glpi-project/glpi) | ITSM | Très actif (commits juin-juillet 2026) | GPL-3.0 / GPL-2.0 | Le concurrent interne le plus sérieux si la collectivité a déjà GLPI : couvre ~70 % de Sésame, pêche sur la matrice agent×applications et le workflow multi-niveaux. |
| [iTop (Combodo)](https://github.com/Combodo/iTop) | ITSM | Actif (commits juillet 2026) | AGPL-3.0 | Remplacement théoriquement possible (objets custom + approbations par e-mail), mais personnalisation XML coûteuse, UX datée et contrainte AGPL. |
| [DataPass (DINUM)](https://github.com/betagouv/datapass) | Demandes d'accès | Repo archivé en 2026 (service en ligne maintenu côté DINUM) | AGPL-3.0 | Pas un remplaçant, mais la meilleure inspiration UX/vocabulaire : un produit d'État français « demande → instruction → validation », stack proche (TS + PostgreSQL). |
| [Access (Discord)](https://github.com/discord/access) | Demandes d'accès | Très actif (v1.6.1, avril 2026) | Apache-2.0 | Le plus proche de Sésame fonctionnellement (expiration obligatoire de tout accès, propriétaires d'applications), mais architecturé autour d'Okta — à piller, pas à déployer. |
| [Snipe-IT](https://github.com/grokability/snipe-it) | Gestion de parc | Très actif (releases bimensuelles, v8.5) | AGPL-3.0 | Ne gère pas les comptes, mais complément naturel pour le volet matériel des départs (checkout/checkin, sync AD, API REST). |

*Écartés notamment : OpenIAM (code communautaire non réellement public, derniers push GitHub en 2017), Soffid (communauté quasi inexistante, licence ambiguë — pas de fichier LICENSE dans les repos), Wren:IDM (~46 étoiles, trop risqué en production mais patterns précieux), ConsoleMe et Glide (archivés).*

## 2. Pourrait-il remplacer Sésame ?

**Non, honnêtement — et la vérification le confirme.** Les deux seuls candidats crédibles, midPoint et Syncope, sont de vrais IGA activement maintenus qui couvrent tout le périmètre sur le papier ; mais ce sont des plateformes Java pensées pour des équipes IAM dédiées, avec personnalisation en XML/Groovy ou BPMN, plusieurs mois de montée en compétence et une UX administrateur anglophone inadaptée aux valideurs RH/métiers d'une collectivité — le coût d'intégration dépasse celui du développement de Sésame. Les alternatives « françaises » IGA sont fragiles : OpenIAM n'a pas de code source communautaire réel, Soffid dépend entièrement de son éditeur, FusionIAM est un assemblage de 5 briques sans moteur de workflow. Côté outils légers, chacun ne couvre qu'une tranche : FusionDirectory et LAM gèrent l'annuaire sans workflow de demandes ; Keycloak, LemonLDAP::NG et authentik font de l'authentification, pas de la gestion de comptes ; Access (Discord) présuppose Okta ; GLPI+plugins est le seul à s'approcher (70 %), mais sans matrice fine agent×applications ni validation multi-niveaux paramétrable. Le créneau exact de Sésame — guichet de demandes + validation paramétrable + suivi des accès applicatifs pour fiabiliser les départs, sur AD en lecture — est vide, y compris côté ADULLACT (vérifié : aucun projet de collectivité ne le couvre).

## 3. Ce qu'on reprend dans Sésame

### Priorité 1 — v1, peu coûteux, structurant

1. **Cycle de vie par états plutôt que booléen actif/inactif** *(midPoint)* : champ `lifecycle_state` (brouillon / proposé / actif / suspendu / déprécié / archivé) sur les comptes ET les habilitations. `suspended` = agent en préavis/absence longue ; `deprecated` = appli en décommissionnement (accès existants maintenus, plus assignable).
2. **Modèle « assignment » avec dates** *(midPoint, Access, entitlements-app)* : table `habilitation(agent, application, valid_from, valid_to, lifecycle_state)` ; le « leaver » devient une requête SQL (`valid_to` atteint → alerte). Règle en cascade : agent non-actif → toutes ses habilitations inactives.
3. **Expiration par défaut de tout accès** *(Access — Discord)* : jamais d'habilitation sans date de fin, avec relances mail avant échéance. Indispensable pour contractuels, saisonniers, stagiaires.
4. **Vocabulaire et cycle DataPass** *(DataPass)* : demandeur / instructeur / rapporteur / abonné ; brouillon → soumise → **demande de modifications** (plutôt qu'un refus sec) → validée/refusée ; page d'accueil différenciée par rôle ; rôle « abonné » = notification sans droit d'action pour les chefs de service.
5. **Distinction Entitlement / Grant** *(Baton)* : séparer « accès possible à une appli » de « accès accordé à l'agent X » dans le modèle de données.
6. **Suivi par ressource cible** *(Syncope)* : une demande validée génère une ligne de statut PAR application (AD : fait, messagerie : fait, finances : en attente) — c'est le cœur du suivi des accès voulu.
7. **Journal d'audit en événements typés avec avant/après** *(Syncope, Wren:IDM, Keycloak)* : chaque transition = événement nommé (qui, quoi, quand, ancien/nouveau statut), avec tag de source (web/api/batch, idée Access) ; hooks d'événements centralisés pour brancher mails et audit au même endroit.
8. **Signaux AD dans l'annuaire** *(Keycloak, Casdoor, LSC)* : décoder `userAccountControl`/`pwdLastSet` → badges « désactivé dans l'AD », « verrouillé », « mdp expiré » ; filtre `(&(objectClass=user)(objectCategory=person))` ; cache PostgreSQL resynchronisé par delta plutôt qu'interrogation LDAPS à chaque affichage.
9. **Détection des départs non traités** *(LSC, authentik)* : rapport « comptes AD désactivés/disparus ou sans connexion depuis X jours (via `lastLogonTimestamp`) sans demande de sortie associée » — la killer feature de fiabilisation des départs, en pure lecture.
10. **Checklist de départ bloquante** *(plugin GLPI Resources, Checklistomania)* : un départ n'est clos que quand chaque item est coché ; items à échéances relatives (« badge : J-1 », « compte AD : jour J »), checklist définie centralement et instanciée par agent.

### Priorité 2 — v1 si le budget le permet, sinon v2

11. **Profils d'accès / « birthright roles »** *(LdapCherry, OpenIAM, FusionDirectory)* : un profil métier (« agent état civil ») se décompose automatiquement en groupes AD + comptes applicatifs ; templates avec attributs calculés (uid/mail générés depuis nom+prénom) ; « donnez-lui les mêmes accès que son collègue » *(BLAZAM)*.
12. **Workflow = machine à états en tables** *(Syncope, Opal, Glide)* : statuts nommés + transitions autorisées + approbateurs par étape, en PostgreSQL — pas de moteur BPMN. Schéma de paramétrage par application : étapes ordonnées, auto-approbation, durée max, flag « application sensible » ajoutant un niveau *(Soffid)*.
13. **Approbation par e-mail avec relance/escalade** *(iTop)* : le valideur agit depuis le mail sans se connecter ; délais d'expiration.
14. **Intégration Snipe-IT via API** *(Snipe-IT)* : à la sortie d'un agent, interroger Snipe-IT pour lister le matériel encore « sorti » — ne pas redévelopper la gestion de parc.
15. **Vue « tout ce que détient l'agent X »** *(Snipe-IT, LemonLDAP::NG)* : matrice agent × applications + matériel, LA vue offboarding.

### Priorité 3 — v2 et au-delà

16. **Écriture AD via LSC plutôt qu'en Node** *(LSC)* : brique BSD éprouvée (unicodePwd, userAccountControl, post-hooks JSON/LDIF pour l'audit, mode `clean` pour le sens AD→base) ; framing READ_ONLY → WRITABLE *(Keycloak)* pour la roadmap. Attention : les bugs MSAD connus de Keycloak montrent que l'écriture AD est le point dur — prévoir des tests d'intégration dédiés.
17. **Délégation « Access Levels × OUs »** *(BLAZAM)* : qui a le droit de faire quoi, sur quelle branche de l'annuaire.
18. **Campagnes de revue des accès** *(midPoint, Soffid)* : campagne → étapes → cas → décision accepter/révoquer → remédiation automatique (la révocation génère la demande de suppression) ; gestion des non-réponses par réitération ou délégation après délai.
19. **Séquences d'arrivée échelonnées** *(ChiefOnboarding)* : modèle de tâches J-7/J-1/J+30 avec déclenchement conditionnel (compte applicatif seulement après validation du compte AD) et webhooks génériques vers les applis métiers.
20. **API SCIM-compatible** *(Janssen)* : aligner le vocabulaire de l'API utilisateurs (userName, active, department, manager) pour les interconnexions futures.

## 4. Trois recommandations finales

1. **Développer Sésame, en assumant le « make » sur un périmètre étroit, et documenter ce choix.** La recherche prouve qu'aucun outil libre ne couvre le créneau (guichet de demandes + validation paramétrable + suivi des accès + fiabilisation des départs sur AD) ; midPoint/Syncope coûteraient plus cher à intégrer qu'à développer. Si la collectivité utilise déjà GLPI, rédiger une comparaison honnête GLPI+Resources+FormCreator vs Sésame sur les trois manques identifiés (matrice agent×applications, workflow multi-niveaux, UX dédiée) avant de lancer le chantier.

2. **Ne pas coder ce qui existe déjà : composer.** SSO de Sésame via Keycloak (ou le LemonLDAP::NG existant), self-service mot de passe via LTB Self Service Password, matériel via l'API Snipe-IT, écriture AD v2 via LSC. Sésame reste le cerveau (demandes, workflow, suivi, audit) et délègue les organes éprouvés — c'est aussi ce qui le maintiendra petit et maintenable par une DSI de collectivité.

3. **Concevoir dès la v1 le modèle de données pour le départ, et viser la mutualisation.** Les trois invariants issus des meilleurs outils — états de cycle de vie, habilitations datées avec expiration par défaut, journal d'audit avant/après — coûtent peu au démarrage et sont presque impossibles à retrofitter. Adopter l'UX DSFR (référence : `codegouvfr/keycloak-theme-dsfr`) et le vocabulaire DataPass (habilitation, instruction, demande de modifications), mettre une licence explicite dès le premier commit (contre-exemple Soffid), puis publier Sésame sur le Comptoir du Libre et la forge ADULLACT : le créneau est vide, une mutualisation entre collectivités est crédible et conforme à la doctrine « argent public = code public ».
