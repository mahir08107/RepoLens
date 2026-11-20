import express, { Request, Response } from 'express';
import { ArchitectureMap, RepoSkeleton } from '../../../shared/types.js';
import { getCachedMap, saveCachedMap } from '../db/firestoreCache.js';
import { labelModulesWithGemma } from '../ai/gemmaLabeler.js';
import { buildArchitectureMap } from '../ai/geminiArchitect.js';

export const mapRouter = express.Router();

/**
 * POST /api/generate-map
 * Generates or retrieves an ArchitectureMap for a RepoSkeleton.
 * Defensively accepts:
 * 1. { repoUrl, commitSha, skeleton: { files, ... } }
 * 2. { repoUrl, commitSha, files: [...] } (direct RepoSkeleton)
 * 3. { skeleton: RepoSkeleton }
 */
mapRouter.post('/generate-map', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    if (!body) {
      res.status(400).json({ error: 'Missing request body' });
      return;
    }

    // Defensive parsing of input format
    const candidateSkeleton: RepoSkeleton = body.skeleton || body;
    const repoUrl = body.repoUrl || candidateSkeleton.repoUrl;
    const commitSha = body.commitSha || candidateSkeleton.commitSha;
    const files = candidateSkeleton.files || body.files;

    if (!repoUrl || !commitSha || !Array.isArray(files)) {
      res.status(400).json({
        error: 'Invalid payload: must provide repoUrl, commitSha, and files (as RepoSkeleton or { repoUrl, commitSha, skeleton })',
      });
      return;
    }

    const skeleton: RepoSkeleton = {
      repoUrl,
      commitSha,
      files,
    };

    // Step 1: Check cache by commitSha
    const cachedMap = await getCachedMap(commitSha);
    if (cachedMap) {
      console.log(`[mapRoute] Cache hit for commitSha: ${commitSha}`);
      res.status(200).json({
        ...cachedMap,
        cached: true,
      });
      return;
    }

    console.log(`[mapRoute] Cache miss for commitSha: ${commitSha}. Running two-tier AI pipeline...`);

    // Step 2: Classify modules using Gemma 4B
    const labeledModules = await labelModulesWithGemma(skeleton.files);

    // Step 3: Infer architectural dependency edges using Gemini Flash Lite
    const architectureMap: ArchitectureMap = await buildArchitectureMap(skeleton, labeledModules);

    // Step 4: Save result to cache (Firestore / in-memory fallback)
    await saveCachedMap(commitSha, architectureMap);

    // Step 5: Return complete ArchitectureMap JSON
    res.status(200).json({
      ...architectureMap,
      cached: false,
    });
  } catch (error: any) {
    console.error('[mapRoute] Error generating architecture map:', error);
    res.status(500).json({
      error: 'Failed to generate architecture map',
      details: error?.message || 'Unknown error',
    });
  }
});
