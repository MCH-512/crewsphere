
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCWx8oTDso4ueIN56DJimo8hAUxRKPOy4Q",
  authDomain: "aircrew-hub.firebaseapp.com",
  projectId: "aircrew-hub",
  storageBucket: "aircrew-hub.appspot.com",
  messagingSenderId: "390858189228",
  appId: "1:390858189228:web:d5acc01380d0ff2fa67209"
};

// Check if all config values are provided
export const isConfigValid = Object.values(firebaseConfig).every(
  (value) => Boolean(value)
);

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length) {
    app = getApp();
} else {
    app = initializeApp(firebaseConfig);
}

auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app);

export { app, auth, db, storage };
