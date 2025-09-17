
// firebase_admin.js
const admin = require('firebase-admin');

class FirebaseAdmin {
  constructor(config) {
    const keyPath = config.firebaseAdmin.serviceAccountKeyPath;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(require(keyPath)),
        projectId: config.projectId
      });
    }
    this.db = admin.firestore();
    this.collection = config.firebaseAdmin.auditCollection || 'auditLogs';
  }

  async logEvent(type, event, extra = {}) {
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
