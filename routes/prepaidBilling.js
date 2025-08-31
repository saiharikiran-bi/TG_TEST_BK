import express from 'express';
import { 
    getPrepaidBillingStats, 
    getPrepaidBillingTable
} from '../controllers/prepaidBillingController.js';

const router = express.Router();

router.get('/stats', getPrepaidBillingStats);
router.get('/table', getPrepaidBillingTable);

export default router; 