import express from 'express';
import { getOverallData } from '../controllers/overallController.js';

const router = express.Router();

router.get('/', getOverallData);

export default router; 