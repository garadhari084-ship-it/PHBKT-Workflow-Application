import { initializeApp, getApps, cert, getApp as getAdminApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const ADMIN_APP_NAME = 'firebase-admin-app-phbkt';

let _firestore: Firestore | null = null;

export function getAdminFirestore(): Firestore {
  if (!_firestore) {
    if (!getApps().some(app => app.name === ADMIN_APP_NAME)) {
      try {
        let credential;
        let projectId;
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          try {
            const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
            if (serviceAccount.private_key) {
              serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
            credential = cert(serviceAccount);
            projectId = serviceAccount.project_id;
          } catch (e: any) {
            console.warn("Could not parse GOOGLE_APPLICATION_CREDENTIALS as JSON, ignoring or treating as path.", e.message);
          }
        }
        initializeApp({
           ...(credential ? { credential } : {}),
           ...(projectId ? { projectId } : {})
        }, ADMIN_APP_NAME);
      } catch (error) {
        console.error("Firebase admin init error:", error);
        throw new Error('Firebase Admin could not be initialized. Ensure GOOGLE_APPLICATION_CREDENTIALS is set.');
      }
    }
    _firestore = getFirestore(getAdminApp(ADMIN_APP_NAME));
  }
  return _firestore;
}

export let firestore: Firestore | null = null;
try {
  firestore = getAdminFirestore();
} catch (e: any) {
  console.warn("Firestore failed to initialize on startup:", e.message);
}
