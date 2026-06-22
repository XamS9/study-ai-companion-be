import { Router } from 'express';
import { getDashboard } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  res.json(await getDashboard(req.userId!));
});
