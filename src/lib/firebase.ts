
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCWx8oTDso4ueIN56DJimo8hAUxRKPOy4Q",
  authDomain: "aircrew-hub.firebaseapp.com",
  projectId: "aircrew-hub",
  storageBucket: "aircrew-hub.appspot.com", // Corrected from your input, usually .appspot.com
  messagingSenderId: "390858189228",
  appId: "1:390858189228:web:d5acc01380d0ff2fa67209"
  // measurementId is optional and often not needed for basic setup
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

