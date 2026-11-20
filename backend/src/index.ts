import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { mapRouter } from './routes/mapRoute.js';
import { chatRouter } from './routes/chatRoute.js';
import { feedbackRouter } from './routes/feedbackRoute.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const ALLOWED_ORIGINS = new Set(
  [
    'https://repolens-fc889.web.app',
    'https://repolens-fc889.firebaseapp.com',
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
  ].filter((origin): origin is string => Boolean(origin))
);

// Enable CORS for Firebase Hosting & local development
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));

// Health check endpoints
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes under /api
app.use('/api', mapRouter);
app.use('/api', chatRouter);
app.use('/api', feedbackRouter);

// Start local server only when not running on Vercel serverless or tests
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[RepoLens Backend] Server listening on port ${PORT}`);
  });
}

export default app;
