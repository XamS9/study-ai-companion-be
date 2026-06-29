import { Router } from 'express';
import { rateLimit } from '../../middleware/rate-limit.js';
import * as controller from './subjects.controller.js';

export const subjectsRouter = Router();

subjectsRouter.get('/', controller.list);
subjectsRouter.post('/', controller.create);
subjectsRouter.get('/:id', controller.detail);
subjectsRouter.get('/:id/questions', controller.questions);
// AI regeneration is throttled per user + subject (in-memory; see rate-limit.ts).
subjectsRouter.post(
  '/:id/regenerate-questions',
  rateLimit(60_000, (req) => `${req.userId}:${req.params.id}`),
  controller.regenerateQuestions,
);
subjectsRouter.patch('/:id', controller.update);
subjectsRouter.delete('/:id', controller.remove);
