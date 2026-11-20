import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  Auth,
} from 'firebase/auth';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
  username?: string | null;
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  description: string | null;
  language: string | null;
  updated_at: string;
}

const getViteEnv = (viteKey: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[viteKey] || '';
    }
  } catch {}
  return '';
};

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    getViteEnv('VITE_FIREBASE_API_KEY') ||
    '',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    process.env.VITE_FIREBASE_AUTH_DOMAIN ||
    getViteEnv('VITE_FIREBASE_AUTH_DOMAIN') ||
    'repolens-fc889.firebaseapp.com',
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    getViteEnv('VITE_FIREBASE_PROJECT_ID') ||
    'repolens-fc889',
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

function isFirebaseConfigured(): boolean {
  const key =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    getViteEnv('VITE_FIREBASE_API_KEY') ||
    '';
  return key.trim().length > 0;
}

export function getFirebaseAuth(): Auth | null {
  if (authInstance) return authInstance;
  if (!isFirebaseConfigured()) return null;

  try {
    if (!appInstance) {
      appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    }
    authInstance = getAuth(appInstance);
    return authInstance;
  } catch (err) {
    console.warn('[Firebase] Auth initialization failed:', err);
    return null;
  }
}

// Initialized if credentials exist; null during SSG build/missing env without crashing
const auth: Auth | null = isFirebaseConfigured() ? getFirebaseAuth() : null;

const githubProvider = new GithubAuthProvider();
githubProvider.addScope('repo');
githubProvider.addScope('read:user');

const GITHUB_TOKEN_STORAGE_KEY = 'repolens_gh_token';
const GITHUB_USER_STORAGE_KEY = 'repolens_gh_username';

/**
 * Subscribes to Firebase Auth state changes.
 */
export function onAuthUserChanged(callback: (user: AuthUser | null) => void) {
  const currentAuth = auth || getFirebaseAuth();
  if (currentAuth && typeof (currentAuth as any)?.onAuthStateChanged === 'function') {
    return (currentAuth as any).onAuthStateChanged(callback);
  }
  // Safely inform subscriber if Auth is unavailable (e.g. static prerendering or unconfigured)
  if (typeof window !== 'undefined') {
    setTimeout(() => callback(null), 0);
  }
  return () => {};
}

/**
 * Signs in the user with GitHub via popup and captures OAuth credentials.
 * Stores the GitHub access token in sessionStorage for repository reading.
 */
export async function signInWithGitHub(): Promise<{ user: AuthUser; githubAccessToken: string | null }> {
  const currentAuth = auth || getFirebaseAuth();
  if (!currentAuth) {
    throw new Error('Firebase Auth is not configured. Please set NEXT_PUBLIC_FIREBASE_API_KEY in your environment.');
  }
  const result = await signInWithPopup(currentAuth, githubProvider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  const githubAccessToken = credential?.accessToken || null;
  let username: string | null = (result as any)?._tokenResponse?.screenName || null;

  if (!username && githubAccessToken) {
    try {
      const ghRes = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${githubAccessToken}`,
        },
      });
      if (ghRes.ok) {
        const ghData = await ghRes.json();
        username = ghData?.login || null;
      }
    } catch {}
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    if (githubAccessToken) {
      window.sessionStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, githubAccessToken);
    }
    if (username) {
      window.sessionStorage.setItem(GITHUB_USER_STORAGE_KEY, username);
    }
  }

  return {
    user: {
      uid: result.user.uid,
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: (result.user as any).photoURL || null,
      username,
    },
    githubAccessToken,
  };
}

/**
 * Signs the user out of Firebase and clears stored GitHub credentials.
 */
export async function signOutUser(): Promise<void> {
  const currentAuth = auth || getFirebaseAuth();
  if (currentAuth) {
    try {
      await signOut(currentAuth);
    } catch {}
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(GITHUB_USER_STORAGE_KEY);
    window.sessionStorage.removeItem('repolens_github_token');
  }
}

/**
 * Retrieves the stored GitHub OAuth access token from sessionStorage.
 */
export function getStoredGitHubToken(): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return (
      window.sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) ||
      window.sessionStorage.getItem('repolens_github_token')
    );
  }
  return null;
}

/**
 * Retrieves the stored GitHub username from sessionStorage.
 */
export function getStoredGitHubUsername(): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage.getItem(GITHUB_USER_STORAGE_KEY);
  }
  return null;
}

/**
 * Fetches the authenticated user's public & private GitHub repositories strictly client-side.
 */
export async function fetchUserRepositories(token: string): Promise<GitHubRepoItem[]> {
  const res = await fetch(
    'https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator,organization_member',
    {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to load repositories (${res.status})`);
  }
  return res.json();
}

export { auth };
export type { AuthUser as User };
