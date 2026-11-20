declare module 'firebase/app' {
  export interface FirebaseApp {
    name: string;
    options: Record<string, any>;
  }
  export function initializeApp(options: Record<string, any>): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function getApp(): FirebaseApp;
}

declare module 'firebase/auth' {
  export interface User {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  }
  export interface Auth {
    currentUser: User | null;
  }
  export class GithubAuthProvider {
    addScope(scope: string): void;
    static credentialFromResult(result: any): { accessToken?: string } | null;
  }
  export function getAuth(app?: any): Auth;
  export function signInWithPopup(auth: Auth, provider: any): Promise<{ user: User }>;
  export function signOut(auth: Auth): Promise<void>;
}
