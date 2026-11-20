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

  // 1. Check if running on Google Cloud Run or GCP environment with Application Default Credentials (ADC)
  const isCloudRun = Boolean(process.env.K_SERVICE || process.env.K_REVISION);
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const resolvedCredentialsPath = credentialsPath
    ? (path.isAbsolute(credentialsPath) ? credentialsPath : path.resolve(process.cwd(), credentialsPath))
    : null;

  // Local Dev: If a valid service account file exists on disk, load that credential
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

  // Cloud Run Production or ADC Environment
  if (isCloudRun || projectId) {
    try {
      admin.initializeApp({
        projectId: projectId || undefined,
      });
      db = admin.firestore();
      console.log(`[firestoreCache] Connected to Firebase Admin Firestore using Application Default Credentials (ADC)${projectId ? ` [Project: ${projectId}]` : ''}.`);
      return db;
    } catch (err) {
      console.warn('[firestoreCache] Failed to initialize Firebase Admin using ADC:', err);
    }
  }

  // Graceful fallback to in-memory cache if no credentials or project is available
  console.warn('[firestoreCache] Warning: Neither valid serviceAccountKey.json nor Cloud Run ADC environment found. Falling back to local in-memory cache.');
  return null;
}

const firestoreDb = initializeFirestore();

/**
 * Checks the architecture_maps Firestore collection for document ID commitSha.
 * Falls back to in-memory cache if Firestore is not initialized.
 */
export async function getCachedMap(commitSha: string): Promise<ArchitectureMap | null> {
  if (!commitSha) return null;

  if (firestoreDb) {
    try {
      const docRef = firestoreDb.collection('architecture_maps').doc(commitSha);
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        const data = snapshot.data();
        if (data && data.map) {
          return data.map as ArchitectureMap;
        }
      }
    } catch (err) {
      console.warn(`[firestoreCache] Firestore read error for commitSha ${commitSha}:`, err);
    }
  }

  // Fallback to in-memory cache
  const inMem = inMemoryCache.get(commitSha);
  return inMem ? inMem.map : null;
}

/**
 * Saves the generated ArchitectureMap under document ID commitSha along with a createdAt timestamp.
 */
export async function saveCachedMap(commitSha: string, map: ArchitectureMap): Promise<void> {
  if (!commitSha || !map) return;

  const createdAt = new Date().toISOString();

  // Always keep in-memory cache updated
  inMemoryCache.set(commitSha, { map, createdAt });

  if (firestoreDb) {
    try {
      const docRef = firestoreDb.collection('architecture_maps').doc(commitSha);
      await docRef.set({
        commitSha,
        repoUrl: map.repoUrl,
        map,
        createdAt,
      });
      console.log(`[firestoreCache] Saved ArchitectureMap to Firestore under commitSha: ${commitSha}`);
    } catch (err) {
      console.warn(`[firestoreCache] Firestore write error for commitSha ${commitSha}:`, err);
    }
  }
}
