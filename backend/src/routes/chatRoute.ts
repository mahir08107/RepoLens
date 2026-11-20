import express, { Request, Response } from 'express';

export const chatRouter = express.Router();

/**
 * Placeholder stub for Phase 3 Chat endpoint.
 * Returns 501 Not Implemented cleanly until Phase 3 implementation.
 */
chatRouter.post('/chat', async (_req: Request, res: Response): Promise<void> => {
  res.status(501).json({
    message: 'Chat endpoint is not implemented yet. Scheduled for Phase 3.',
  });
});

export default chatRouter;
