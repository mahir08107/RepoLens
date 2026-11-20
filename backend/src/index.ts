import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { mapRouter } from './routes/mapRoute';
import { chatRouter } from './routes/chatRoute';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS and JSON parsing with 5mb limit
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes under /api
app.use('/api', mapRouter);
app.use('/api', chatRouter);

// Start server if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[RepoLens Backend] Server listening on port ${PORT}`);
  });
}

export default app;
