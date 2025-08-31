import express from 'express';
import { getAllMeters, getMeterById, createMeter, updateMeter, deleteMeter, getMeterStats, getMeterView, getDataLoggersList, getMeterHistory } from '../controllers/meterController.js';
import { validateMeterData, createMeterSchema } from '../validations/meterValidation.js';
import { populateUserFromCookies } from '../utils/cookieUtils.js';

const router = express.Router();

// Apply location-based filtering middleware to all routes
router.use(populateUserFromCookies);

router.get('/', getAllMeters);
router.get('/stats', getMeterStats);
router.get('/dataloggers', getDataLoggersList);
router.get('/:id/view', getMeterView);
router.get('/:id/history', getMeterHistory);
router.get('/:id', getMeterById);
router.post('/', validateMeterData(createMeterSchema), createMeter);
router.put('/:id', updateMeter);
router.delete('/:id', deleteMeter);

export default router; 