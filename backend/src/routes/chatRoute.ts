import express, { Request, Response } from 'express';
import { ArchitectureMap, ChatRequest, RepoSkeleton } from '../../../shared/types.js';
import { getCachedMap } from '../db/firestoreCache.js';
import { answerArchitectureQuestion } from '../ai/geminiChat.js';

export const chatRouter = express.Router();

/**
 * POST /api/chat
 * Contextual AI Chat Copilot endpoint using Gemini Flash Lite.
 * Expects { question, commitSha, skeleton, selectedNodeId? }
 * Defensively supports top-level files array in skeleton or root.
 */
chatRouter.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    if (!body) {
      res.status(400).json({ error: 'Missing request body' });
      return;
    }

    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (!question) {
      res.status(400).json({ error: 'Invalid or missing question in request body' });
      return;
    }

    const candidateSkeleton: RepoSkeleton = body.skeleton || body;
    const commitSha = body.commitSha || candidateSkeleton.commitSha;
    const files = candidateSkeleton.files || body.files;

    if (!commitSha || !Array.isArray(files)) {
      res.status(400).json({
        error: 'Invalid payload: must provide commitSha and skeleton (with files array)',
      });
      return;
    }

    const skeleton: RepoSkeleton = {
      repoUrl: candidateSkeleton.repoUrl || body.repoUrl || '',
      commitSha,
      files,
    };

    const chatRequest: ChatRequest = {
      commitSha,
      selectedNodeId: typeof body.selectedNodeId === 'string' ? body.selectedNodeId : undefined,
      question,
      skeleton,
    };

    // Look up cachedMap by commitSha so Gemini knows exact rendered node IDs
    let cachedMap: ArchitectureMap | null = null;
    try {
      cachedMap = await getCachedMap(commitSha);
    } catch (cacheErr) {
      console.warn(`[chatRoute] Error querying cache for commitSha ${commitSha}:`, cacheErr);
    }

    // Call Contextual Architecture Q&A service
    const chatResponse = await answerArchitectureQuestion(chatRequest, cachedMap);

    res.status(200).json(chatResponse);
  } catch (error: any) {
    console.error('[chatRoute] Unhandled error during chat:', error);
    res.status(500).json({
      error: 'Failed to process chat request',
      details: error?.message || 'Unknown error',
    });
  }
});

export default chatRouter;
