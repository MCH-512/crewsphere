
# CrewSphere Watchdog Agent

This directory contains the source code for the autonomous Watchdog agent, a Node.js service designed to monitor, analyze, and automatically propose fixes for the CrewSphere application.

## How It Works

The agent operates in a continuous loop, following these steps:
1.  **Collect**: It queries a data source (like BigQuery) for recent high-severity error logs.
2.  **Analyze**: It uses a Large Language Model (LLM) to analyze each error, determine if it's actionable, and suggest a code patch.
3.  **Policy Check**: It verifies that the suggested changes do not violate security policies (e.g., modifying critical files like `firestore.rules`).
4.  **Repair**: If the policy check passes, it creates a new branch on GitHub, applies the patch, and opens a Pull Request for human review.
5.  **Audit**: Every significant action taken by the agent is logged to a dedicated, immutable audit trail in Firestore.

## Quick Start (Local PoC)

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Configure**:
    -   Copy `config.example.json` to `config.json`.
    -   Fill in the required values in `config.json`:
        -   `projectId`: Your Google Cloud Project ID.
        -   `bigQuery`: The dataset and table for logs.
        -   `llm`: Your LLM provider details (API key, model).
        -   `github`: Your repository owner, name, and a GitHub token with `repo` scope.
        -   `firebaseAdmin`: The path to your Firebase Admin SDK service account key file.

3.  **GCP Setup**:
    -   Enable the BigQuery API in your GCP project.
    -   Create the dataset and table specified in `config.json` (e.g., `crew_logs.events`).
    -   Download a service account key from GCP with permissions for BigQuery and Firestore, and place it at the path specified in `config.json`.

4.  **Run the Agent**:
    ```bash
    npm start
    ```

The Watchdog will now start its monitoring loop, checking for new events at the interval defined in `config.json`.
