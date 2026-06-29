import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { aiRouter } from '../modules/ai/ai.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { examsRouter } from '../modules/exams/exams.routes.js';
import { materialsRouter } from '../modules/materials/materials.routes.js';
import { profileRouter } from '../modules/profile/profile.routes.js';
import { subjectsRouter } from '../modules/subjects/subjects.routes.js';

/** All feature routes live under `/api` and require a valid Supabase JWT. */
export const apiRouter = Router();

apiRouter.use(requireAuth);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/subjects', subjectsRouter);
apiRouter.use('/materials', materialsRouter);
apiRouter.use('/exams', examsRouter);
apiRouter.use('/ai', aiRouter);
