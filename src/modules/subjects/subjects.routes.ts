import { Router } from 'express';
import * as controller from './subjects.controller.js';

export const subjectsRouter = Router();

subjectsRouter.get('/', controller.list);
subjectsRouter.post('/', controller.create);
subjectsRouter.get('/:id', controller.detail);
subjectsRouter.patch('/:id', controller.update);
subjectsRouter.delete('/:id', controller.remove);
