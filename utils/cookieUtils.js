
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * @param {string} cookieHeader - Raw cookie header string
 * @returns {Object} Parsed cookies object
 */
const parseCookiesManually = (cookieHeader) => {
    if (!cookieHeader) return {};
    
    try {
        return cookieHeader.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            if (key && value) {
                acc[key.trim()] = decodeURIComponent(value.trim());
            }
            return acc;
        }, {});
    } catch (error) {
        console.log('Error parsing cookies manually:', error.message);
        return {};
    }
};

/**
 * Decode JWT token with fallback
 * @param {string} token - JWT token string
 * @returns {Object|null} Decoded token payload or null
 */
const decodeJWTToken = (token) => {
    if (!token) return null;
    
    try {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return decoded;
        } catch (jwtError) {
            console.log('JWT verification failed, trying decode without verification:', jwtError.message);
            
            const decoded = jwt.decode(token);
            if (decoded) {
                return decoded;
            }
        }
    } catch (error) {
        console.log('JWT token processing failed:', error.message);
    }
    
    return null;
};

/**
 * Extract user details from cookies and populate req.user
 * @param {Object} req - Express request object
 * @returns {Object|null} User details object or null if not found
 */
export const extractUserFromCookies = (req) => {
    try {
        
        const parsedCookies = req.cookies || {};
        const manualCookies = parseCookiesManually(req.headers.cookie);
        const allCookies = { ...parsedCookies, ...manualCookies };
        
        
        if (allCookies.userDetails) {
            try {
                const userDetails = JSON.parse(allCookies.userDetails);
                if (userDetails && typeof userDetails === 'object' && userDetails.locationId) {
                    return userDetails;
                }
            } catch (parseError) {
                console.log('Error parsing userDetails cookie:', parseError.message);
            }
        }
        
        // Second: try to extract from accessToken cookie (JWT)
        if (allCookies.accessToken) {
            const decoded = decodeJWTToken(allCookies.accessToken);
            
            if (decoded && decoded.locationId) {
                
                const userDetails = {
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
                return userDetails;
            }
        }
        
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            
            const decoded = decodeJWTToken(token);
            if (decoded && decoded.locationId) {
                
                const userDetails = {
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
                return userDetails;
            }
        }
        
        return null;
    } catch (error) {
        console.log('Error extracting user details:', error.message);
        return null;
    }
};


export const populateUserFromCookies = (req, res, next) => {
    const userDetails = extractUserFromCookies(req);
    if (userDetails) {
        req.user = userDetails;
    } else {
        console.log('No user details found, req.user remains undefined');
    }
    next();
};

/**
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
