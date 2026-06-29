import { Router } from 'express';
import { getActivity, getDashboard, getStats } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  res.json(await getDashboard(req.db!, req.userId!));
});

dashboardRouter.get('/stats', async (req, res) => {
  res.json(await getStats(req.db!, req.userId!));
});

dashboardRouter.get('/activity', async (req, res) => {
  res.json(await getActivity(req.db!, req.userId!));
});
