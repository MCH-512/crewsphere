# CrewSphere: Industrial-Grade Aviation Crew Portal

![Next.js Audit Status](https://img.shields.io/badge/Next.js%20Audit-PASSÉ-brightgreen?logo=next.js&style=for-the-badge)

**CrewSphere** is an enterprise-grade, intelligent web application designed to serve as the central operational hub for airline crew members. Built with a **server-first architecture** using Next.js 15, TypeScript, and Firebase, it provides a comprehensive suite of tools for schedule management, training, communication, and daily operations, all while enforcing the highest standards of code quality and performance through an integrated, Dockerized audit system.

The application is architected around two core interfaces: a user-centric portal for crew members and a powerful, data-driven command center for administrators.

---

## Core Features for Crew Members

-   **Intelligent Dashboard (`/`)**: A central overview of the day's schedule, critical alerts, and mandatory training progress.
-   **Interactive Schedule (`/my-schedule`)**: A monthly calendar view of personal schedules, including flights, training, and leave.
-   **Flight Swap Board (`/flight-swap`, `/my-swaps`)**: A marketplace for posting and requesting flight swaps, with real-time status tracking.
-   **E-Learning Center (`/training`)**: A catalog of mandatory and optional courses with chapter tracking, automated quizzes, and certificate generation.
-   **Resource Hub**:
    -   **Document Library (`/document-library`)**: Centralized access to operational manuals and company policies.
    -   **My Documents (`/my-documents`)**: A personal space for managing licenses and certificates with expiry tracking.
    -   **Suggestion Box (`/suggestion-box`)**: An anonymous or named forum for submitting and upvoting improvement ideas.
    -   **Requests System (`/requests`)**: A structured form for official requests to various departments (HR, Planning).
-   **Toolbox (`/toolbox`)**: A suite of practical utilities, including an AI-powered weather decoder, FTL calculator, and live flight tracker.

---

## Command Center for Administrators (`/admin`)

The admin panel is designed as an **intelligent command center**, not just a management interface. It leverages server-side data aggregation to provide actionable insights and automate decision-making processes.

-   **Action-Oriented Dashboard**: Displays at-a-glance KPIs for pending tasks (requests, validations, swaps) and a **weekly activity trend chart**.
-   **Smart Planning Tools**:
    -   **Flight & Training Scheduling**: Forms are equipped with **real-time conflict detection**, preventing double-booking of crew members by checking their availability *before* submission.
    -   **Automated Swap & Leave Validation**: The system automatically checks for schedule conflicts when an admin reviews a swap or leave request, presenting a clear "Conflict Detected" or "No Conflict" status.
-   **AI-Enhanced Content Management**:
    -   **AI Quiz Generation**: Automatically creates quiz questions from course content.
    -   **AI Report Summarization**: Generates executive summaries and identifies key risks from purser reports upon submission.
-   **Full-Spectrum Management**: Comprehensive tools for managing users, courses, documents, alerts, system settings, and viewing audit logs.

---

## Architectural Pillars & Quality Assurance

CrewSphere is built on a foundation of modern, robust, and scalable technologies, with a strict adherence to best practices.

-   **Server-First Architecture**: Leveraging Next.js App Router, Server Components, and Server Actions to ensure optimal performance, security, and SEO. Data is fetched and processed on the server first, delivering fully-rendered, interactive pages to the client.
-   **Automated Quality Control**:
    -   **Static Analysis Script (`nextjs-audit.js`)**: A custom Node.js script that enforces 23 rules for best practices, from preventing `useEffect(fetch)` to ensuring accessibility standards.
    -   **Dockerized Environment**: The audit script is containerized with Docker, ensuring **100% reproducible builds** and zero local dependencies for analysis. This allows seamless execution in any CI/CD pipeline (e.g., GitHub Actions).
    -   **CI/CD Integration-Ready**: The architecture is designed for automated quality gates, blocking non-compliant pull requests before they enter the main branch.
-   **Tech Stack**:
    -   **Frontend**: Next.js 15 (App Router), React, TypeScript
    -   **Backend & Database**: Firebase (Firestore, Auth, Storage)
    -   **AI Features**: Google AI & Genkit
    -   **UI & Styling**: Tailwind CSS, shadcn/ui, Recharts, Framer Motion
    -   **Infrastructure**: Docker

This application was engineered not just to be functional, but to be **intelligent, reliable, and maintainable** at an industrial scale.