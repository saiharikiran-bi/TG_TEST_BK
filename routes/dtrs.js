import express from 'express';
import { getDTRTable, getFeedersForDTR, getDTRAlerts, getDTRAlertsTrends, getDTRStats, getConsumptionStats, getFeederStats, getInstantaneousStats, getConsolidatedDTRStats, getDTRConsumptionAnalytics, getIndividualDTRAlerts, getKVAMetrics, getDTRFilterOptions, getMeterStatus, getFilterOptions, getAllMetersData, searchDTRs, getLTSideFuseBlownData, getUnbalancedDTRsData, getPowerFailureFeedersData, getHTSideFuseBlownData } from '../controllers/dtrController.js';
import { populateUserFromCookies } from '../utils/cookieUtils.js';

const router = express.Router();

// Apply cookie-based user population middleware to all DTR routes
router.use(populateUserFromCookies);

// Specific routes must come BEFORE parameterized routes
router.get('/', getDTRTable);
router.get('/lt-fuse-blown', getLTSideFuseBlownData);
router.get('/unbalanced-dtrs', getUnbalancedDTRsData);
router.get('/power-failure-feeders', getPowerFailureFeedersData);
router.get('/ht-fuse-blown', getHTSideFuseBlownData);
router.get('/search', searchDTRs);
router.get('/meter-status', getMeterStatus);
router.get('/filter-options', getDTRFilterOptions);
router.get('/stats', getConsolidatedDTRStats);
router.get('/alerts', getDTRAlerts);
router.get('/alerts/trends', getDTRAlertsTrends);
router.get('/filter/filter-options', getFilterOptions);
router.get('/all-meters', getAllMetersData);

// Parameterized routes must come AFTER specific routes
router.get('/:dtrId', getFeedersForDTR);
router.get('/:dtrId/feederStats', getFeederStats);
router.get('/:dtrId/consumptionAnalytics', getDTRConsumptionAnalytics);
router.get('/:dtrId/instantaneousStats', getInstantaneousStats);
router.get('/:dtrId/alerts', getIndividualDTRAlerts);
router.get('/:dtrId/kvaMetrics', getKVAMetrics);

export default router; 