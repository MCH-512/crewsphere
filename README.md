
# AirCrew Hub : Portail Complet pour Équipages Aériens

**AirCrew Hub** est une application web moderne et complète, conçue pour être le portail centralisé pour les membres d'équipage d'une compagnie aérienne. Développée avec Next.js, TypeScript et Firebase, elle offre une suite d'outils et de fonctionnalités pour simplifier la gestion des horaires, la formation, la communication et les opérations quotidiennes.

L'application est divisée en deux interfaces principales : un portail pour les membres d'équipage et un panneau d'administration puissant pour la gestion.

---

## Fonctionnalités pour les Membres d'Équipage

### 1. **Tableau de Bord Personnalisé (`/`)**
- **Accueil Centralisé** : Affiche un aperçu de l'emploi du temps du jour, les alertes critiques, et l'état d'avancement des formations obligatoires.
- **Accès Rapide** : Liens directs vers les fonctionnalités les plus utilisées comme le "Toolbox" ou le système de requêtes.
- **Visualisations** : Graphiques illustrant la progression des formations et le statut des requêtes soumises.

### 2. **Mon Emploi du Temps (`/my-schedule`)**
- **Calendrier Interactif** : Vue mensuelle de l'emploi du temps personnel, incluant vols, formations, jours de repos et congés.
- **Détails d'Activité** : En cliquant sur une date, l'utilisateur peut voir les détails de chaque activité, comme la liste des membres d'équipage pour un vol.

### 3. **Gestion des Échanges de Vols (`/flight-swap`, `/my-swaps`)**
- **Tableau d'Échange** : Un "marché" où les membres d'équipage peuvent poster un vol qu'ils souhaitent échanger.
- **Système de Requête** : Permet de proposer un de ses propres vols en échange d'un vol posté par un collègue.
- **Suivi des Échanges** : Une page dédiée (`/my-swaps`) permet de suivre le statut de ses propres propositions et requêtes d'échange (en attente, approuvé, rejeté).

### 4. **Centre de Formation en Ligne (`/training`)**
- **Catalogue de Cours** : Accès à des cours de formation obligatoires et optionnels.
- **Apprentissage Interactif** : Chaque cours contient des chapitres à lire. L'utilisateur doit marquer chaque chapitre comme lu pour débloquer le quiz final.
- **Quiz et Certification** : À la fin de chaque cours, un quiz est généré. En cas de réussite, un certificat est automatiquement créé et peut être consulté.

### 5. **Ressources et Communication**
- **Bibliothèque de Documents (`/document-library`)** : Accès centralisé à tous les manuels opérationnels, documents de sécurité et politiques de la compagnie.
- **Mes Documents (`/my-documents`)** : Espace personnel pour que chaque membre d'équipage télécharge et suive la date d'expiration de ses propres documents (passeport, licence, certificat médical).
- **Boîte à Suggestions (`/suggestion-box`)** : Permet de soumettre des idées d'amélioration (anonymement ou non) et de voter pour les suggestions des autres.
- **Système de Requêtes (`/requests`)** : Un formulaire structuré pour soumettre des requêtes officielles à différents départements (RH, planning, etc.).
- **Hub Communautaire (`/community-hub`)** : Un fil d'actualité social où les membres d'équipage peuvent partager des messages et interagir.

### 6. **Toolbox (`/toolbox`)**
- Une suite d'outils pratiques, incluant :
  - **Décodeur Météo par IA** : Traduit les codes METAR/TAF en langage clair.
  - **Calculateur FTL** : Aide à calculer les limitations de temps de vol selon les normes EASA.
  - **Carte de Vol en Direct** : Visualise le trafic aérien mondial en temps réel.
  - **Glossaires et Guides** : Références pour l'alphabet phonétique, le jargon aéronautique, et les guides de bonnes pratiques.

---

## Fonctionnalités du Panneau d'Administration (`/admin`)

### 1. **Gestion des Utilisateurs et des Opérations**
- **Gestion des Utilisateurs** : Créer, modifier, et assigner des rôles (pilote, purser, admin, etc.) aux utilisateurs.
- **Gestion des Vols** : Planifier des vols, assigner des équipages complets, et gérer les requêtes d'échange de vols.
- **Gestion des Formations** : Créer des sessions de formation en présentiel et assigner des participants.

### 2. **Gestion de Contenu**
- **Gestion des Cours en Ligne** : Créer et publier des cours, incluant les chapitres et les quiz. **Intègre une IA pour générer automatiquement les questions de quiz à partir du contenu du cours.**
- **Gestion des Documents** : Uploader et gérer les documents officiels de la bibliothèque.
- **Gestion des Alertes** : Créer et diffuser des notifications importantes à des groupes d'utilisateurs spécifiques.

### 3. **Supervision et Conformité**
- **Validation des Documents** : Approuver les documents personnels soumis par les membres d'équipage.
- **Revue des Rapports de Vol** : Consulter et gérer les rapports soumis par les commissaires de bord. **Intègre une IA pour générer un résumé des points clés de chaque rapport.**
- **Suivi des Requêtes et Suggestions** : Gérer et répondre aux requêtes et suggestions des utilisateurs.
- **Journal d'Audit** : Une vue complète de toutes les actions administratives effectuées sur la plateforme.

---

## Pile Technologique

- **Framework Frontend** : Next.js 15 (App Router)
- **Langage** : TypeScript
- **Base de Données** : Firestore (NoSQL)
- **Authentification** : Firebase Authentication
- **Stockage de Fichiers** : Firebase Storage
- **Fonctionnalités IA** : Google AI & Genkit
- **UI & Style** : Tailwind CSS, shadcn/ui, Framer Motion

Cette application a été conçue pour être à la fois puissante pour les administrateurs et intuitive pour les membres d'équipage, en tirant parti des technologies modernes pour offrir une expérience fluide et intelligente.
