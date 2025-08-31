import express from 'express';
import {
    subAppLogin,
    verifySubAppToken,
    getSubAppProfile,
    logout,
    refreshAccessToken
} from '../controllers/subAppAuthController.js';
import { populateUserFromCookies } from '../utils/cookieUtils.js';

const router = express.Router();

// Public routes
router.post('/login', subAppLogin);
router.post('/refresh-token', refreshAccessToken);

// Protected routes - use cookie-based user population
router.get('/verify-token', populateUserFromCookies, verifySubAppToken);
router.get('/profile', populateUserFromCookies, getSubAppProfile);
router.post('/logout', populateUserFromCookies, logout);

export default router; 