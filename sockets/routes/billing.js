import express from 'express';
import { 
    getPostpaidBillingStats, 
    getPostpaidBillingTable, 
    generateMonthlyBills, 
} from '../controllers/billingController.js';

const router = express.Router();

router.get('/postpaid/stats', getPostpaidBillingStats);
router.get('/postpaid/table', getPostpaidBillingTable);
router.post('/generate-monthly', generateMonthlyBills);

export default router; 