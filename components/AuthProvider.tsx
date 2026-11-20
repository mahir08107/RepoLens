'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AuthUser,
  onAuthUserChanged,
  signInWithGitHub as firebaseSignInWithGitHub,
  signOutUser as firebaseSignOutUser,
  getStoredGitHubToken,
  getStoredGitHubUsername,
} from '@/frontend/src/services/firebase';

interface AuthContextValue {
  user: AuthUser | null;
  githubAccessToken: string | null;
  authLoading: boolean;
  signInWithGithub: () => Promise<{ user: AuthUser; githubAccessToken: string | null }>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [githubAccessToken, setGithubAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    setGithubAccessToken(getStoredGitHubToken());
    const unsubscribe = onAuthUserChanged((fbUser) => {
      if (fbUser) {
        const storedUsername = getStoredGitHubUsername();
        setUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName,
          email: fbUser.email,
          photoURL: fbUser.photoURL,
          username: fbUser.username || storedUsername,
        });
        setGithubAccessToken(getStoredGitHubToken());
      } else {
        setUser(null);
        setGithubAccessToken(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGithub = useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await firebaseSignInWithGitHub();
      setUser(res.user);
      setGithubAccessToken(res.githubAccessToken);
      return res;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthLoading(true);
    try {
      await firebaseSignOutUser();
      setUser(null);
      setGithubAccessToken(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        githubAccessToken,
        authLoading,
        signInWithGithub,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

