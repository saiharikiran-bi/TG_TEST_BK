/**
 * Utility functions for extracting user details from cookies
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Extract user details from cookies and populate req.user
 * @param {Object} req - Express request object
 * @returns {Object|null} User details object or null if not found
 */
export const extractUserFromCookies = (req) => {
    try {
        // First try to get user details from cookies
        if (req.cookies && req.cookies.userDetails) {
            try {
                const userDetails = JSON.parse(req.cookies.userDetails);
                if (userDetails && typeof userDetails === 'object') {
                    return userDetails;
                }
            } catch (parseError) {
                // Error parsing userDetails cookie
            }
        }
        
        // Second: try to extract from accessToken cookie (JWT)
        if (req.cookies && req.cookies.accessToken) {
            try {
                const token = req.cookies.accessToken;
                const decoded = jwt.verify(token, JWT_SECRET);
                

                
                return {
                    userId: decoded.userId,
                    username: decoded.username,
                    email: decoded.email,
                    role: decoded.role,
                    roles: decoded.roles || [],
                    permissions: decoded.permissions || [],
                    accessLevel: decoded.accessLevel,
                    locationId: decoded.locationId,
                    appId: decoded.appId
                };
            } catch (jwtError) {
                // JWT token verification failed
            }
        }
        
        // Third: try to extract from Authorization header
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                

                
                return {
                    userId: decoded.userId,
                    username: decoded.username,
                    email: decoded.email,
                    role: decoded.role,
                    roles: decoded.roles || [],
                    permissions: decoded.permissions || [],
                    accessLevel: decoded.accessLevel,
                    locationId: decoded.locationId,
                    appId: decoded.appId
                };
            } catch (jwtError) {
                // JWT token verification failed
            }
        }
        

        return null;
    } catch (error) {
        // Error extracting user details
        return null;
    }
};

/**
 * Middleware to populate req.user from cookies (optional)
 * Use this if you want to automatically populate req.user
 */
export const populateUserFromCookies = (req, res, next) => {
    const userDetails = extractUserFromCookies(req);
    if (userDetails) {
        req.user = userDetails;
    }
    next();
};

/**
 * Check if user has access to a specific location
 * @param {Object} req - Express request object
 * @param {number} resourceLocationId - Location ID of the resource being accessed
 * @returns {boolean} True if user has access, false otherwise
 */
export const checkLocationAccess = (req, resourceLocationId) => {
    const userDetails = extractUserFromCookies(req);
    
    if (!userDetails || !userDetails.locationId) {
        return false;
    }

    if (userDetails.locationId === resourceLocationId) {
        return true;
    }

    return false;
};

/**
 * Get user's location ID from cookies
 * @param {Object} req - Express request object
 * @returns {number|null} User's location ID or null if not found
 */
export const getUserLocationId = (req) => {
    const userDetails = extractUserFromCookies(req);
    return userDetails?.locationId || null;
};
