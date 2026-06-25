'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import type { User as AppUser } from '@/lib/types';

// New type that combines Firebase Auth User with our AppUser properties
export type EnhancedUser = User & AppUser;

// Internal state for user authentication
interface UserAuthState {
  user: EnhancedUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  // User authentication state
  user: EnhancedUser | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: EnhancedUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult {
  user: EnhancedUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}


/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [authState, setAuthState] = useState<{
    authUser: User | null;
    isLoading: boolean;
    error: Error | null;
  }>({
    authUser: null,
    isLoading: true,
    error: null,
  });

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isAppUserLoading, setIsAppUserLoading] = useState(true);

  // Effect for auth state changes
  useEffect(() => {
    if (!auth) {
      setAuthState({ authUser: null, isLoading: false, error: new Error("Auth service not available.") });
      return;
    }
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => setAuthState({ authUser: user, isLoading: false, error: null }),
      (error) => setAuthState({ authUser: null, isLoading: false, error })
    );
    return () => unsubscribe();
  }, [auth]);

  // Effect for Firestore user document changes, dependent on auth state
  useEffect(() => {
    if (!firestore || !authState.authUser) {
      setAppUser(null);
      setIsAppUserLoading(!!authState.authUser); // Not loading if user is logged out, otherwise wait for doc.
      return;
    }

    const userDocRef = doc(firestore, `users/${authState.authUser.uid}`);
    setIsAppUserLoading(true);

    const unsubscribe = onSnapshot(
      userDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setAppUser(docSnap.data() as AppUser);
        } else {
          // User document doesn't exist, create it.
          const newUserDoc: AppUser = {
            id: authState.authUser!.uid,
            email: authState.authUser!.email!,
            role: 'User',
            firstName: authState.authUser!.displayName?.split(' ')[0] || '',
            lastName: authState.authUser!.displayName?.split(' ')[1] || '',
            phoneNumber: authState.authUser!.phoneNumber || '',
          };
          try {
            await setDoc(userDocRef, newUserDoc);
            setAppUser(newUserDoc);
          } catch (e) {
            console.error("FirebaseProvider: Error creating user document:", e);
            setAppUser(null);
          }
        }
        setIsAppUserLoading(false);
      },
      (error) => {
        console.error("FirebaseProvider: Error listening to user document:", error);
        setAppUser(null);
        setIsAppUserLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, authState.authUser]);


  // Memoize the final combined user object
  const enhancedUser = useMemo((): EnhancedUser | null => {
    if (!authState.authUser) return null;
    
    // Return a combined user object if appUser data is available, otherwise return the base auth user
    return appUser ? { ...authState.authUser, ...appUser } as EnhancedUser : (authState.authUser as EnhancedUser);

  }, [authState.authUser, appUser]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: enhancedUser,
      isUserLoading: authState.isLoading || isAppUserLoading,
      userError: authState.error,
    };
  }, [firebaseApp, firestore, auth, enhancedUser, authState.isLoading, isAppUserLoading, authState.error]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => { // Renamed from useAuthUser
  const { user, isUserLoading, userError } = useFirebase(); // Leverages the main hook
  return { user, isUserLoading, userError };
};