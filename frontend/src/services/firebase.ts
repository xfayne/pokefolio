import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getEnvironment } from './environment';

export function getFirebaseServices() {
  const environment = getEnvironment();
  if (!environment) return null;
  // A named app prevents accidental reuse of a different Firebase project.
  const app = getApps().find((app) => app.name === 'pokefolio-staging-react') ?? initializeApp(environment.firebase, 'pokefolio-staging-react');
  if (app.options.projectId !== environment.firebase.projectId) throw new Error('Firebase project mismatch');
  return { auth: getAuth(app), db: getFirestore(app) };
}
export function subscribeToAuth(listener: (user: User | null) => void, onError: (error: Error) => void) {
  let active = true;
  let unsubscribe: (() => void) | undefined;
  queueMicrotask(() => {
    if (!active) return;
    try {
      const services = getFirebaseServices();
      if (!services) { listener(null); return; }
      unsubscribe = onAuthStateChanged(services.auth, (user) => { if (active) listener(user); }, (error) => { if (active) onError(error); });
    } catch (error) {
      if (active) onError(error instanceof Error ? error : new Error('Authentication initialization failed'));
    }
  });
  return () => { active = false; unsubscribe?.(); };
}
export async function getIdToken() { return getFirebaseServices()?.auth.currentUser?.getIdToken() ?? null; }
// No Firestore writes or data migrations in the framework foundation.
