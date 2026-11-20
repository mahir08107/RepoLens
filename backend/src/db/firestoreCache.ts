import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { ArchitectureMap } from '../../../shared/types.js';

dotenv.config();

let db: admin.firestore.Firestore | null = null;
const inMemoryCache = new Map<string, { map: ArchitectureMap; createdAt: string }>();

function initializeFirestore(): admin.firestore.Firestore | null {
  if (db) return db;

  if (admin.apps.length > 0) {
    db = admin.firestore();
    return db;
  }

  // 0. Vercel / Serverless JSON env credential
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      db = admin.firestore();
      console.log('[firestoreCache] Connected to Firebase Admin Firestore using FIREBASE_SERVICE_ACCOUNT env.');
      return db;
    } catch (err) {
      console.warn('[firestoreCache] Failed to initialize Firebase Admin with FIREBASE_SERVICE_ACCOUNT:', err);
    }
  }

  // 1. Local Dev: If GOOGLE_APPLICATION_CREDENTIALS points to an existing file on disk
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const resolvedCredentialsPath = credentialsPath
    ? (path.isAbsolute(credentialsPath) ? credentialsPath : path.resolve(process.cwd(), credentialsPath))
    : null;

  if (resolvedCredentialsPath && fs.existsSync(resolvedCredentialsPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedCredentialsPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      db = admin.firestore();
      console.log('[firestoreCache] Connected to Firebase Admin Firestore using serviceAccountKey.');
      return db;
    } catch (err) {
      console.warn(`[firestoreCache] Failed to initialize Firebase Admin with credentials file at ${resolvedCredentialsPath}:`, err);
    }
  }

  // 2. Google Cloud Run ADC (only on Cloud Run, never on Vercel without explicit service account)
  const isCloudRun = Boolean(process.env.K_SERVICE || process.env.K_REVISION);
  if (isCloudRun && !process.env.VERCEL) {
    try {
      const projectId =
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.FIREBASE_PROJECT_ID ||
        process.env.GCLOUD_PROJECT;
      admin.initializeApp({
        projectId: projectId || undefined,
      });
      db = admin.firestore();
      console.log(`[firestoreCache] Connected to Firebase Admin Firestore using Cloud Run ADC${projectId ? ` [Project: ${projectId}]` : ''}.`);
      return db;
    } catch (err) {
      console.warn('[firestoreCache] Failed to initialize Firebase Admin using ADC:', err);
    }
  }

  // Graceful stateless fallback (e.g., Vercel without FIREBASE_SERVICE_ACCOUNT)
  console.warn('[Cache] Firestore disabled — running stateless');
  return null;
}

const firestoreDb = initializeFirestore();

/**
 * Checks the architecture_maps Firestore collection for document ID commitSha.
 * Falls back to in-memory cache if Firestore is not initialized.
 */
export async function getCachedMap(commitSha: string): Promise<ArchitectureMap | null> {
  if (!commitSha) return null;

  // 1. Check in-memory cache first for instant 0ms retrieval
  const inMem = inMemoryCache.get(commitSha);
  if (inMem) return inMem.map;

  if (firestoreDb) {
    try {
      const docRef = firestoreDb.collection('architecture_maps').doc(commitSha);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
      const fetchPromise = (async () => {
        const snapshot = await docRef.get();
        if (snapshot.exists) {
          const data = snapshot.data();
          if (data && data.map) return data.map as ArchitectureMap;
        }
        return null;
      })();

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      if (result) {
        inMemoryCache.set(commitSha, { map: result, createdAt: new Date().toISOString() });
        return result;
      }
    } catch (err) {
      console.warn(`[firestoreCache] Firestore read error for commitSha ${commitSha}:`, err);
    }
  }

  return null;
}

/**
 * Saves the generated ArchitectureMap under document ID commitSha along with a createdAt timestamp.
 */
export async function saveCachedMap(commitSha: string, map: ArchitectureMap): Promise<void> {
  if (!commitSha || !map) return;

  const createdAt = new Date().toISOString();

  // Always keep in-memory cache updated synchronously
  inMemoryCache.set(commitSha, { map, createdAt });

  if (firestoreDb) {
    try {
      const docRef = firestoreDb.collection('architecture_maps').doc(commitSha);
      // Non-blocking background save to prevent holding up client HTTP response
      docRef
        .set({
          commitSha,
          repoUrl: map.repoUrl,
          map,
          createdAt,
        })
        .then(() => {
          console.log(`[firestoreCache] Saved ArchitectureMap to Firestore under commitSha: ${commitSha}`);
        })
        .catch((err) => {
          console.warn(`[firestoreCache] Firestore write error for commitSha ${commitSha}:`, err?.message || err);
        });
    } catch (err) {
      console.warn(`[firestoreCache] Firestore write error for commitSha ${commitSha}:`, err);
    }
  }
}
