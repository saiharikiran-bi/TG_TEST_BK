import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_SECRET = process.env.JWT_SECRET || 'your-super-secret-refresh-key-change-in-production';
const JWT_REFRESH_EXPIRES_IN_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '7', 10);

const isProduction = process.env.NODE_ENV === 'production';
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

// Helper function to parse PostgreSQL JSON format
const parsePostgresJson = (jsonValue) => {
    try {
        const str = jsonValue.toString().trim();
        
        if (str.startsWith('{') && str.endsWith('}')) {
            // PostgreSQL array format: {1,2,4}
            const result = str.slice(1, -1).split(',').map(id => parseInt(id.trim()));
            return result;
        } else if (str.includes(',') && !str.startsWith('[') && !str.startsWith('{')) {
            // PostgreSQL array format without braces: 1,2,4
            const result = str.split(',').map(id => parseInt(id.trim()));
            return result;
        } else {
            // Standard JSON format: [1,2,4]
            const result = JSON.parse(str);
            return result;
        }
    } catch (error) {
        return [];
    }
};

// Note: Keep helpers for other endpoints if needed. The login method below is self-contained per request.

// Sub-app login
export const subAppLogin = async (req, res) => {
    try {
        const { identifier, password, appId, rememberMe } = req.body;

        // Minimal validation
        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: 'Username/email and password are required' });
        }

        // Validate required fields
        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username/email and password are required'
            });
        }

        // Find user by email or username with roles, permissions, and location
        let user = await prisma.users.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { username: identifier }
                ]
            },
            include: {
                roles: {
                    include: {
                        role_permissions: true
                    }
                }
            }
        });
        


        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
        }



        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Check if user is locked
        if (user.isLocked && user.lockoutUntil && user.lockoutUntil > new Date()) {
            return res.status(401).json({
                success: false,
                message: 'Account is temporarily locked'
            });
        }

        // Verify password
        if (!user.password) {
            return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
        }

        // Reset basic login state
        await prisma.users.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date() }
        });

        // Extract user roles and permissions
        const userRoles = user.roles ? [user.roles.name] : [];
        const userPermissions = [];


        
        // Permissions from role_permissions (schema uses single Int id per row)
        if (user.roles?.role_permissions?.length) {
            const uniquePermissionIds = [
                ...new Set(
                    user.roles.role_permissions
                        .filter(rp => rp.permissionId !== null && rp.permissionId !== undefined)
                        .map(rp => rp.permissionId)
                )
            ];
            if (uniquePermissionIds.length > 0) {
                const permissions = await prisma.permissions.findMany({ where: { id: { in: uniquePermissionIds } } });
                userPermissions.push(...permissions.map(p => p.name));
            }
        }
        

        
        // Generate tokens (inline, short and clear)
        const token = jwt.sign({
            userId: user.id,
            appId,
            type: 'sub-app',
            roles: userRoles,
            permissions: userPermissions,
            locationId: user.locationId
        }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // Map accessLevel to role (fallback)
        const accessLevelToRole = {
            'RESTRICTED': 'accountant',
            'NORMAL': 'accountant',
            'ELEVATED': 'moderator',
            'ADMIN': 'admin',
            'SUPER_ADMIN': 'admin'
        };
        
        const userRole = userRoles.length > 0 ? userRoles[0] : (accessLevelToRole[user.accessLevel] || 'accountant');
        

        
        // Store user details in cookies for easy access in controllers
        const userDetailsCookie = {
            userId: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: userRole,
            roles: userRoles,
            permissions: userPermissions,
            accessLevel: user.accessLevel,
            locationId: user.locationId,
            appId: appId
        };
        

        
        // Set user details cookie (non-httpOnly for easy access)
        res.cookie('userDetails', JSON.stringify(userDetailsCookie), {
            httpOnly: false,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
            domain: cookieDomain
        });
        
        // Store access token in cookie
        res.cookie('accessToken', token, {
            httpOnly: isProduction,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
            domain: cookieDomain
        });

        // Generate and store refresh token when rememberMe is true
        if (rememberMe) {
            const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: `${JWT_REFRESH_EXPIRES_IN_DAYS}d` });
            const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
            await prisma.refresh_tokens.upsert({
                where: { userId: user.id },
                update: { token: refreshToken, expiresAt },
                create: { userId: user.id, token: refreshToken, expiresAt }
            });
            res.cookie('refreshToken', refreshToken, {
                httpOnly: isProduction,
                secure: isProduction,
                sameSite: isProduction ? 'none' : 'lax',
                path: '/api/sub-app/auth/refresh-token',
                maxAge: JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
                domain: cookieDomain
            });
        }
        

        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: userRole,
                    roles: userRoles,
                    permissions: userPermissions,
                    accessLevel: user.accessLevel,
                    locationId: user.locationId,
                    location: user.locations ? {
                        id: user.locations.id,
                        name: user.locations.name,
                        code: user.locations.code,
                        address: user.locations.address
                    } : null
                },
                token,
                appId
            }
        });
        


    } catch (error) {
        console.error('Sub-app login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
};

// Verify sub-app token
export const verifySubAppToken = async (req, res) => {
    try {

        
        if (!req.user || !req.user.userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }
        
        const user = await prisma.users.findFirst({
            where: { id: req.user.userId },
            include: {
                roles: {
                    include: {
                        role_permissions: true
                    }
                }
            }
        });
        
        if (!user) {
    
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }



        // Extract user roles and permissions
        const userRoles = user.roles ? [user.roles.name] : [];
        const userPermissions = [];
        
        // Extract permissions from role_permissions
        if (user.roles?.role_permissions) {
            user.roles.role_permissions.forEach(rolePerm => {
                if (rolePerm.permissionId) {
                    const parsed = parsePostgresJson(rolePerm.permissionId);
                    const idsArray = Array.isArray(parsed)
                        ? parsed
                        : (typeof parsed === 'number' && !Number.isNaN(parsed))
                            ? [parsed]
                            : [];
                }
            });
        }
        
        // Fetch permission names from permission IDs
        if (user.roles?.role_permissions) {
            const allPermissionIds = [];
            user.roles.role_permissions.forEach(rolePerm => {
                if (rolePerm.permissionId) {
                    const parsed = parsePostgresJson(rolePerm.permissionId);
                    const idsArray = Array.isArray(parsed)
                        ? parsed
                        : (typeof parsed === 'number' && !Number.isNaN(parsed))
                            ? [parsed]
                            : [];
                    allPermissionIds.push(...idsArray);
                }
            });
            const uniquePermissionIds = [...new Set(allPermissionIds)];
            if (uniquePermissionIds.length > 0) {
                const permissions = await prisma.permissions.findMany({
                    where: { id: { in: uniquePermissionIds } }
                });
                userPermissions.push(...permissions.map(p => p.name));
            }
        }
        
        // Map accessLevel to role (fallback)
        const accessLevelToRole = {
            'RESTRICTED': 'accountant',
            'NORMAL': 'accountant',
            'ELEVATED': 'moderator',
            'ADMIN': 'admin',
            'SUPER_ADMIN': 'admin'
        };
        
        const userRole = userRoles.length > 0 ? userRoles[0] : (accessLevelToRole[user.accessLevel] || 'accountant');

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: userRole,
                    roles: userRoles,
                    permissions: userPermissions,
                    accessLevel: user.accessLevel,
                    locationId: user.locationId,
                    location: user.locations ? {
                        id: user.locations.id,
                        name: user.locations.name,
                        code: user.locations.code,
                        address: user.locations.address
                    } : null
                },
                appId: req.user.appId
            }
        });

    } catch (error) {
        console.error('Sub-app token verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Token verification failed'
        });
    }
};

// Logout function to clear cookies
export const logout = async (req, res) => {
    try {
        // Clear all authentication cookies
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('token', { path: '/' });
        res.clearCookie('refreshToken', { path: '/api/sub-app/auth/refresh-token' });
        

        
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
};

// Get sub-app user profile
export const getSubAppProfile = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }
        
        const user = await prisma.users.findUnique({
            where: { id: req.user.userId }
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    accessLevel: user.accessLevel
                }
            }
        });

    } catch (error) {
        console.error('Sub-app profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile'
        });
    }
}; 

// Refresh access token using refresh token
export const refreshAccessToken = async (req, res) => {
    try {
        const tokenFromCookie = req.cookies?.refreshToken;
        const tokenFromBody = req.body?.refreshToken;
        const refreshToken = tokenFromCookie || tokenFromBody;

        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token missing' });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch (e) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        const existing = await prisma.refresh_tokens.findUnique({ where: { userId: decoded.userId } });
        if (!existing || existing.token !== refreshToken || existing.expiresAt <= new Date()) {
            return res.status(401).json({ success: false, message: 'Refresh token invalid or expired' });
        }

        // Fetch user with roles and permissions to rebuild claims
        const user = await prisma.users.findFirst({
            where: { id: decoded.userId },
            include: {
                roles: { include: { role_permissions: true } }
            }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'User not active' });
        }

        const userRoles = user.roles ? [user.roles.name] : [];
        const userPermissions = [];
        if (user.roles?.role_permissions?.length) {
            const uniquePermissionIds = [
                ...new Set(
                    user.roles.role_permissions
                        .filter(rp => rp.permissionId !== null && rp.permissionId !== undefined)
                        .map(rp => rp.permissionId)
                )
            ];
            if (uniquePermissionIds.length > 0) {
                const permissions = await prisma.permissions.findMany({ where: { id: { in: uniquePermissionIds } } });
                userPermissions.push(...permissions.map(p => p.name));
            }
        }

        const newAccessToken = jwt.sign({
            userId: user.id,
            appId: req.body?.appId || null,
            type: 'sub-app',
            roles: userRoles,
            permissions: userPermissions,
            locationId: user.locationId
        }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.cookie('accessToken', newAccessToken, {
            httpOnly: isProduction,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
            domain: cookieDomain
        });

        // Rotate refresh token
        const newRefreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: `${JWT_REFRESH_EXPIRES_IN_DAYS}d` });
        const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
        await prisma.refresh_tokens.upsert({
            where: { userId: user.id },
            update: { token: newRefreshToken, expiresAt },
            create: { userId: user.id, token: newRefreshToken, expiresAt }
        });
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: isProduction,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/api/sub-app/auth/refresh-token',
            maxAge: JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
            domain: cookieDomain
        });

        return res.json({ success: true, token: newAccessToken });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ success: false, message: 'Failed to refresh token' });
    }
};