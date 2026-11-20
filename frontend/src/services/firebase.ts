import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  User,
  Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || '',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || '',
};

// Safe initialization guarding against duplicate initialization
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);

const githubProvider = new GithubAuthProvider();
githubProvider.addScope('repo');

const GITHUB_TOKEN_STORAGE_KEY = 'repolens_github_token';

/**
 * Signs in the user with GitHub via popup and captures OAuth credentials.
 * Stores the GitHub access token in sessionStorage for repository reading.
 */
export async function signInWithGitHub(): Promise<{ user: User; githubAccessToken: string | null }> {
  const result = await signInWithPopup(auth, githubProvider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  const githubAccessToken = credential?.accessToken || null;

  if (githubAccessToken && typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, githubAccessToken);
  }

  return {
    user: result.user,
    githubAccessToken,
  };
}

/**
 * Signs the user out of Firebase and clears stored GitHub credentials.
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
  }
}

/**
 * Retrieves the stored GitHub OAuth access token from sessionStorage.
 */
export function getStoredGitHubToken(): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
  }
  return null;
}

