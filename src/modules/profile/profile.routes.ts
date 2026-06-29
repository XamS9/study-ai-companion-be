import { Router } from 'express';
import * as controller from './profile.controller.js';

export const profileRouter = Router();

profileRouter.get('/', controller.get);
profileRouter.patch('/', controller.update);
