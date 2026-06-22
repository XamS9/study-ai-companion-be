import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

/** Operational error with an HTTP status — thrown by services/controllers. */
export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}

/** 404 for unmatched routes. */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

/**
 * Central error handler. Express 5 forwards rejected promises from async route
 * handlers here automatically, so handlers can simply `throw`.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (env.NODE_ENV !== 'test') console.error('[error]', err);
  res.status(500).json({ error: env.NODE_ENV === 'production' ? 'Internal server error' : message });
};
