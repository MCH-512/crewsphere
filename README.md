# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

---

## Deployment to Firebase

This project is configured for deployment using Firebase App Hosting and other Firebase services. Here is the step-by-step process:

### Prerequisites

1.  **Firebase CLI:** Make sure you have the Firebase Command Line Interface installed. If not, you can install it globally with npm:
    ```bash
    npm install -g firebase-tools
    ```

2.  **Firebase Project:** You must have a Firebase project created on the [Firebase Console](https://console.firebase.google.com/).

### Configuration Steps

1.  **Log in to Firebase:**
    Open your terminal and run the following command. This will open a browser window for you to log in to your Google account.
    ```bash
    firebase login
    ```

2.  **Set Up Environment Variables:**
    -   This project uses a `.env` file for environment variables. Ensure your Firebase project configuration keys (apiKey, authDomain, etc.) are correctly set in this file.
    -   You can find these keys in your Firebase project's settings on the Firebase Console (`Project Settings > General > Your apps > Web app`).

3.  **Link Your Firebase Project:**
    -   Open the `.firebaserc` file in the root of your project.
    -   Replace `"your-firebase-project-id"` with your actual Firebase Project ID. You can find this on the Firebase Console settings page.

### Deployment

Once the configuration is complete, you can deploy your application with a single command:

```bash
firebase deploy
```

This command will automatically:
-   **Build** your Next.js application for production.
-   **Deploy** the application to Firebase App Hosting (using `apphosting.yaml`).
-   **Apply** your database security rules from `firestore.rules`.
-   **Deploy** the required database indexes from `firestore.indexes.json`.

After the command finishes, it will provide you with the URL of your live application.
