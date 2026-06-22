import { Router } from 'express';
import * as controller from './ai.controller.js';

export const aiRouter = Router();

aiRouter.post('/generate-questions', controller.questions);
aiRouter.post('/summarize', controller.summary);
aiRouter.post('/flashcards', controller.flashcards);
aiRouter.post('/process-material', controller.process);
