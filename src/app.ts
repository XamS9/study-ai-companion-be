import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import { apiRouter } from './routes/index.js';

// Builds the Express app and wires base middleware, the `/api` feature routes
// (subjects, materials, exams, dashboard, ai), and the 404 + error handlers.
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'studyai-companion-be',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
