import { Router } from 'express';
import { getActivity, getDashboard } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  res.json(await getDashboard(req.userId!));
});

dashboardRouter.get('/activity', async (req, res) => {
  res.json(await getActivity(req.userId!));
});
