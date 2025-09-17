// firebase_admin.js
const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

class FirebaseAdmin {
  constructor(config) {
    this.config = config;
    this.db = null;
    this.initialized = false;
    this.collection = config.firebaseAdmin.auditCollection || 'auditLogs';
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const keyPath = path.resolve(__dirname, this.config.firebaseAdmin.serviceAccountKeyPath);
      const serviceAccount = JSON.parse(await fs.readFile(keyPath, 'utf8'));

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: this.config.projectId
        });
      }
      this.db = admin.firestore();
      this.initialized = true;
      console.log('Firebase Admin SDK initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error.message);
      throw new Error('Firebase Admin SDK could not be initialized. Check your serviceAccountKeyPath in config.json.');
    }
  }

  async logEvent(type, event, extra = {}) {
    if (!this.initialized) {
      console.error('Cannot log event: Firebase Admin SDK not initialized.');
      return;
    }
    // Write audit record as server-side (Admin SDK bypasses rules)
    const doc = {
      type,
      event,
      extra,
      ts: admin.firestore.Timestamp.now()
    };
    await this.db.collection(this.collection).add(doc);
  }
}

module.exports = FirebaseAdmin;
