import express from 'express';
import { getMainWidgets, getMainGraphAnalytics } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/', getMainWidgets);
router.get('/graph-analytics', getMainGraphAnalytics);

export default router; 