import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// No notification routes needed - everything happens automatically in cron jobs
// Just like TGNPDCL_Backend implementation

export default router;