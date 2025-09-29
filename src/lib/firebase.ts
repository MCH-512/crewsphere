import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Check if all config values are provided
export const isConfigValid = Object.values(firebaseConfig).every(
  (value) => Boolean(value) && !String(value).startsWith("{{")
);

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (isConfigValid) {
    if (getApps().length) {
        app = getApp();
    } else {
        app = initializeApp(firebaseConfig);
    }

    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
} else {
    console.warn("Firebase configuration is invalid or missing. Firebase services will be unavailable.");
}

// @ts-expect-error - This is a safe way to export uninitialized services for type-checking, while the runtime check prevents their use.
export { app, auth, db, storage };
    