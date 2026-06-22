import { Router } from 'express';
import * as controller from './materials.controller.js';

export const materialsRouter = Router();

materialsRouter.get('/', controller.list);
materialsRouter.post('/', controller.create);
materialsRouter.get('/:id', controller.detail);
materialsRouter.get('/:id/flashcards', controller.flashcards);
materialsRouter.patch('/:id', controller.update);
materialsRouter.delete('/:id', controller.remove);
