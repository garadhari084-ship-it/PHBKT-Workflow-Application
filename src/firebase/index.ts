'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

const CLIENT_APP_NAME = 'firebase-client-app-phbkt';

export function initializeFirebase() {
  const apps = getApps();
  const clientApp = apps.find(app => app.name === CLIENT_APP_NAME);

  // If the client app isn't initialized, create it.
  if (!clientApp) {
    const newApp = initializeApp(firebaseConfig, CLIENT_APP_NAME);
    return getSdks(newApp);
  }

  // If it's already initialized, return its SDKs.
  return getSdks(clientApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
