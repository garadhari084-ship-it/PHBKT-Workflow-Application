import { initializeApp, getApps, App, cert, getApp as getAdminApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const ADMIN_APP_NAME = 'firebase-admin-app-phbkt';

let firestore: Firestore | null = null;

export function getAdminFirestore(): Firestore {
  if (!firestore) {
    // If GOOGLE_APPLICATION_CREDENTIALS is not set, this might throw or fail. 
    // We should allow basic initialization if deploying on GCP, 
    // but in local dev without it, it needs to not crash on load.
    if (!getApps().some(app => app.name === ADMIN_APP_NAME)) {
      try {
        initializeApp({
          // Using default credentials
        }, ADMIN_APP_NAME);
      } catch (error) {
        console.error("Firebase admin init error:", error);
        throw new Error('Firebase Admin could not be initialized. Ensure GOOGLE_APPLICATION_CREDENTIALS is set.');
      }
    }
    firestore = getFirestore(getAdminApp(ADMIN_APP_NAME));
  }
  return firestore;
}

// Fallback for existing imports that expect it immediately, but let's change consumers to use the function.
// For now, export a proxy so it's lazy.
export const firestoreProxy = new Proxy({} as Firestore, {
  get(target, prop, receiver) {
    const fs = getAdminFirestore();
    return Reflect.get(fs, prop, receiver);
  }
});

// Since the other files import `firestore`, we can export proxy as `firestore`.
export { firestoreProxy as firestore };
