import express from 'express';
import { getAllAssets, addAsset, bulkUploadAssets } from '../controllers/assetController.js';
import { validateAssetData, addAssetSchema, bulkUploadAssetsSchema } from '../validations/assetValidation.js';
import { populateUserFromCookies } from '../utils/cookieUtils.js';

const router = express.Router();

// Apply location-based filtering middleware to all routes
router.use(populateUserFromCookies);

router.get('/', getAllAssets);
router.post('/', validateAssetData(addAssetSchema), addAsset);
router.post('/bulk', validateAssetData(bulkUploadAssetsSchema), bulkUploadAssets);

export default router; 