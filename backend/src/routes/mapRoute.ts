// backend/src/routes/mapRoute.ts
/**
 * Express route for generating an ArchitectureMap.
 * POST /api/generate-map expects a JSON body with a RepoSkeleton.
 * It uses GemmaLabeler to classify modules into zones and GeminiArchitect
 * to produce a Mermaid definition.
 */
import express, { Request, Response } from "express";
import { RepoSkeleton } from "../../shared/types";
import { GemmaLabeler, GemmaLabelingError } from "../ai/gemmaLabeler";
import { GeminiArchitect, GeminiArchitectError } from "../ai/geminiArchitect";

const router = express.Router();

router.post("/generate-map", async (req: Request, res: Response) => {
  const skeleton: RepoSkeleton = req.body;
  if (!skeleton || !skeleton.repoUrl || !skeleton.commitSha) {
    return res.status(400).json({ error: "Invalid RepoSkeleton payload" });
  }

  const labeler = new GemmaLabeler();
  const architect = new GeminiArchitect();

  try {
    const zones = await labeler.labelModules(skeleton);
    const map = await architect.generateMap(skeleton, zones);
    return res.status(200).json(map);
  } catch (e) {
    if (e instanceof GemmaLabelingError) {
      return res.status(502).json({ error: e.message });
    }
    if (e instanceof GeminiArchitectError) {
      return res.status(502).json({ error: e.message });
    }
    // Generic fallback – include stack for debugging in development.
    const status = (e as any).status || 500;
    return res.status(status).json({ error: (e as Error).message });
  }
});

export default router;
