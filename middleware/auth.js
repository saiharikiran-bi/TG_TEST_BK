import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Enhanced middleware to authenticate JWT tokens and extract user details
export const authenticateToken = (req, res, next) => {
    // Try to get token from Authorization header first
    let token = null;
    const authHeader = req.headers['authorization'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    
    // If no token in header, try to get from cookies
    if (!token && req.cookies) {
        token = req.cookies.accessToken || req.cookies.token;
    }
    
    // If still no token, try to get from query parameters (for testing)
    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required. Please provide token in Authorization header, cookies, or query parameter.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Enhanced user object with all necessary fields
        req.user = {
            userId: decoded.userId,
            appId: decoded.appId,
            type: decoded.type,
            roles: decoded.roles || [],
            permissions: decoded.permissions || [],
            locationId: decoded.locationId || null,
            accessLevel: decoded.accessLevel,
            // Keep original decoded data for backward compatibility
            ...decoded
        };
        
        // Log user authentication for debugging
        console.log('🔐 User authenticated:', {
            userId: req.user.userId,
            locationId: req.user.locationId,
            roles: req.user.roles,
            permissions: req.user.permissions?.length || 0
        });
        
        next();
    } catch (error) {
        console.error('❌ Token verification error:', error);
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token',
            error: error.message
        });
    }
};

// Middleware to authorize specific roles
export const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const userRole = req.user.role || req.user.roles;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

// Middleware to check if user is active
export const requireActiveUser = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    // This would typically check against the database
    // For now, we'll assume the user is active if they have a valid token
    next();
}; 