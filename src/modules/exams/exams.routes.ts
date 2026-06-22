import { Router } from 'express';
import * as controller from './exams.controller.js';

export const examsRouter = Router();

examsRouter.get('/', controller.list);
examsRouter.post('/', controller.create);
examsRouter.get('/:id', controller.detail);
examsRouter.post('/:id/submit', controller.submit);
examsRouter.delete('/:id', controller.remove);
