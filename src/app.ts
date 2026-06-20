import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';

// Builds the Express app and wires base middleware. Feature routers (subjects,
// materials, ai, exams, profile) are registered here in a later session from
// src/routes and src/modules.
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'studyai-companion-be',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
