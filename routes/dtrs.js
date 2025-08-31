import express from 'express';
import { getDTRTable, getFeedersForDTR, getDTRAlerts, getDTRAlertsTrends, getDTRStats, getConsumptionStats, getFeederStats, getInstantaneousStats, getConsolidatedDTRStats, getDTRConsumptionAnalytics, getIndividualDTRAlerts, getKVAMetrics, getDTRFilterOptions } from '../controllers/dtrController.js';
import { populateUserFromCookies } from '../utils/cookieUtils.js';

const router = express.Router();

// Apply cookie-based user population middleware to all DTR routes
router.use(populateUserFromCookies);

router.get('/', getDTRTable);
// Specific routes must come BEFORE parameterized routes
router.get('/filter-options', getDTRFilterOptions);
router.get('/stats', getConsolidatedDTRStats);
router.get('/alerts', getDTRAlerts);
router.get('/alerts/trends', getDTRAlertsTrends);
// Parameterized routes come last
router.get('/:dtrId', getFeedersForDTR);
router.get('/:dtrId/feederStats', getFeederStats);
router.get('/:dtrId/consumptionAnalytics', getDTRConsumptionAnalytics);
router.get('/:dtrId/instantaneousStats', getInstantaneousStats);
router.get('/:dtrId/alerts', getIndividualDTRAlerts);
router.get('/:dtrId/kvaMetrics', getKVAMetrics);



export default router; 