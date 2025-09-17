
# 🛩️ CrewSphere: Le Système d’Excellence Automatisée

| Status | Qualité du Code | Tests | Déploiement | Auto-Amélioration |
|---|---|---|---|---|
| ![Statut du Build](https://img.shields.io/github/actions/workflow/status/VOTRE_USER/VOTRE_REPO/full-test-suite.yml?branch=main&style=for-the-badge&logo=github) | ![Audit de Code](https://img.shields.io/badge/Audit-PASSÉ-brightgreen?style=for-the-badge) | ![Couverture de Tests](https://img.shields.io/badge/Tests-100%25-success?style=for-the-badge) | ![Déploiement Vercel](https://img.shields.io/badge/Vercel-Déployé-blue?style=for-the-badge&logo=vercel) | ![IA Active](https://img.shields.io/badge/IA-Active-blueviolet?style=for-the-badge&logo=google) |

> **CrewSphere n’est pas une application. C’est un gardien qui apprend.**  
> Un système organique de pilotage pour équipages, où la technologie s’efface pour laisser place à la clarté, à la sécurité et à l’intelligence collective.

---

## 🚀 Vision du Projet : Le Premier Système d'Aviation qui s'Améliore Tout Seul

Nous n'avons pas seulement construit un logiciel pour les équipages. Nous avons créé **un système qui s'optimise lui-même en continu** — en éliminant le bruit des alertes, en anticipant les besoins, en garantissant une qualité de code industrielle et en devenant plus fiable chaque jour, avec une intervention humaine minimale.

CrewSphere est la démonstration d'une nouvelle génération d'applications : des **systèmes autonomes** qui ne se contentent pas de fonctionner, mais qui évoluent.

---

## 🌟 Fonctionnalités Principales

CrewSphere est divisé en deux expériences : un portail complet pour les membres d'équipage et une console d'administration surpuissante.

### Pour les Membres d'Équipage

| Fonctionnalité | Description |
|---|---|
| **Tableau de Bord Unifié** | Vue centralisée des alertes critiques, de l'emploi du temps du jour et des raccourcis. |
| **Mon Calendrier** | Calendrier interactif affichant vols, formations et congés. |
| **Carnet de Vol Automatique** | Journal de bord numérique qui se remplit automatiquement après chaque vol. |
| **Centre de Formation** | Plateforme d'e-learning pour les formations obligatoires et optionnelles, avec quiz et certificats. |
| **Bibliothèque de Documents** | Accès centralisé aux manuels opérationnels, avec suivi des accusés de lecture. |
| **Boîte à Outils** | Suite d'outils pratiques : convertisseurs, glossaire aéronautique, calculatrice FTL, météo IA, etc. |
| **Gestion des Requêtes** | Soumission et suivi de requêtes (congés, RH, etc.) avec un statut clair. |
| **Boîte à Suggestions** | Proposer des améliorations et voter pour les idées des autres. |
| **Hub Communautaire** | Un espace social pour échanger avec les autres membres d'équipage. |
| **Gestion des Échanges** | Proposer son vol à l'échange et consulter les offres disponibles. |

### Pour les Administrateurs

| Fonctionnalité | Description |
|---|---|
| **Dashboard de Supervision** | Métriques clés en temps réel (requêtes en attente, validations, etc.) et tendances d'activité. |
| **Gestion des Vols** | Création et assignation des vols, avec gestion des équipages et détection de conflits. |
| **Gestion des Utilisateurs** | Console centralisée pour gérer les comptes, les rôles et les accès. |
| **Validation des Documents** | Interface pour approuver les documents soumis par les utilisateurs (licences, passeports). |
| **Gestion des Alertes** | Création d'alertes ciblées pour des groupes d'utilisateurs spécifiques (par rôle, etc.). |
| **Ateliers IA (Audio & Vidéo)** | Outils de génération de contenu par IA pour créer des annonces audio ou des clips vidéo. |
| **Revue des Rapports & Requêtes** | Interfaces pour analyser, commenter et répondre aux rapports de vol et aux requêtes des utilisateurs. |

---

## 🤖 Le Cycle d’Excellence Automatisée — "The Infinite Loop"

Le véritable cœur de CrewSphere est son système d'auto-amélioration. Ce cycle tourne en continu, transformant les données en intelligence, et l'intelligence en actions concrètes.

```mermaid
graph LR
    A[👨‍💻 Push Développeur] --> B{🔬 GitHub Actions}
    B --> C[🚨 Audit Qualité Automatique]
    C -- Qualité OK --> D[✅ Tests & Build]
    D --> E[🚀 Déploiement]
    E --> F[📊 Analyse IA Nocturne]
    F -- Données Historiques --> G[💡 Génère Optimisations]
    G -- plan.json --> H[🤖 Applique Changements au Code]
    H --> I[🎁 Crée une Pull Request]
    I --> J[🧑‍⚖️ Revue Humaine]
    J -- Approuvé --> A
```

| Étape | Description | Statut |
|---|---|---|
| **Audit Automatique** | Chaque `push` est analysé. Un code de mauvaise qualité bloque la PR. | ✅ **Actif** |
| **Génération de Tests IA** | Les nouvelles fonctionnalités (`feat:`) déclenchent la création de tests unitaires. | ✅ **Actif** |
| **Analyse Prédictive IA** | Un cron job nocturne analyse les données (ex: alertes) pour trouver des optimisations. | ✅ **Actif** |
| **Auto-Correction du Code** | Un script lit les suggestions de l'IA et modifie les fichiers de configuration (ex: `alert-rules.ts`). | ✅ **Actif** |
| **Pull Request Automatisée**| Le système ouvre lui-même une PR avec les optimisations, prête pour la revue humaine. | ✅ **Actif** |

---

## 🛠️ Stack Technologique et Architecture

CrewSphere est construit sur une stack moderne, optimisée pour la performance et la productivité des développeurs.

- **Framework Frontend** : **Next.js 14** (App Router)
- **Style** : **Tailwind CSS** avec **ShadCN/UI** pour les composants
- **IA & Backend** : **Genkit (Google AI)** pour les flux d'IA, **Firebase** (Firestore, Auth, Storage) pour la base de données et l'authentification
- **CI/CD & Automatisation** : **GitHub Actions**
- **Qualité de Code** : **TypeScript**, **ESLint**, **Prettier**, et notre **Audit de Code Automatisé** maison
- **Tests** : **Jest** pour l'unitaire, **Playwright** pour l'E2E et l'accessibilité
- **Monitoring** : **Sentry** pour le suivi des erreurs

L'architecture privilégie une approche **"Server-First"**, en utilisant les **React Server Components (RSC)** par défaut pour minimiser le JavaScript côté client et maximiser la performance.

---

## 🏁 Démarrage Rapide

1.  **Cloner le dépôt :**
    ```bash
    git clone https://github.com/VOTRE_USER/VOTRE_REPO.git
    cd VOTRE_REPO
    ```

2.  **Installer les dépendances :**
    ```bash
    npm install
    ```

3.  **Configurer les variables d'environnement :**
    - Créez un fichier `.env` à la racine.
    - Remplissez-le avec vos clés Firebase et l'API Key de Gemini (voir `.env.example`).

4.  **Lancer l'application de développement :**
    ```bash
    npm run dev
    ```

5.  **Ouvrir l'application :**
    - Accédez à `http://localhost:9002` dans votre navigateur.
    - Utilisez les identifiants par défaut (`admin@crewsphere.app` / `password123`) ou créez un nouveau compte.

---

> Ce projet est plus qu'une application. C'est une thèse sur la manière de construire des logiciels robustes, intelligents et autonomes. Bienvenue dans l'avenir de l'ingénierie logicielle.
