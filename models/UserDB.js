import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

class UserDB {
    static async getAllUsers(page = 1, limit = 10, locationId = null) {
        try {
            const skip = (page - 1) * limit;
            
            const whereClause = {};
            
            // If locationId is provided, filter users by location
            if (locationId) {
                whereClause.locationId = locationId;
            }
            
            const totalCount = await prisma.users.count({ where: whereClause });
            
            const users = await prisma.users.findMany({
                where: whereClause,
                include: {
                    roles: true,
                    departments: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            });
            
            const totalPages = Math.ceil(totalCount / limit);
            
            return {
                data: users,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            console.error('Error getting all users:', error);
            throw error;
        }
    }

    static async getUserStats(locationId = null) {
        try {
            const whereClause = {};
            
            // If locationId is provided, filter users by location
            if (locationId) {
                whereClause.locationId = locationId;
            }
            
            const users = await prisma.users.findMany({
                where: whereClause,
                include: {
                    roles: true
                }
            });

            const totalUsers = users.length;
            const activeUsers = users.filter(user => user.isActive).length;
            const inactiveUsers = users.filter(user => !user.isActive).length;

            const roleCounts = {};
            users.forEach(user => {
                if (user.roles) {
                    const roleName = user.roles.name;
                    roleCounts[roleName] = (roleCounts[roleName] || 0) + 1;
                }
            });

            const totalRoles = await prisma.roles.count();

            const stats = {
                totalUsers,
                activeUsers,
                inactiveUsers,
                totalAdmins: roleCounts['ADMIN'] || 0,
                totalAccountants: roleCounts['ACCOUNTANT'] || 0,
                totalModerators: roleCounts['MODERATOR'] || 0,
                totalRoles,
                roleBreakdown: roleCounts
            };
            
            return stats;
        } catch (error) {
            console.error(' UserDB.getUserStats: Database error:', error);
            throw error;
        }
    }

    static async addUser(userData) {
        try {
            const requiredFields = ['username', 'email', 'password', 'firstName'];
            for (const field of requiredFields) {
                if (!userData[field]) {
                    throw new Error(`${field} is required`);
                }
            }

            const existingUsername = await prisma.users.findUnique({
                where: { username: userData.username }
            });
            if (existingUsername) {
                throw new Error('Username already exists');
            }

            const existingEmail = await prisma.users.findUnique({
                where: { email: userData.email }
            });
            if (existingEmail) {
                throw new Error('Email already exists');
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

            const userCreateData = {
                username: userData.username,
                email: userData.email,
                password: hashedPassword,
                firstName: userData.firstName,
                lastName: userData.lastName || '', // Ensure lastName is never undefined
                phone: userData.phone || null,
                profileImage: userData.profileImage || null,
                isActive: userData.isActive !== undefined ? userData.isActive : true,
                isLocked: userData.isLocked !== undefined ? userData.isLocked : false,
                accessLevel: userData.accessLevel || 'NORMAL',
                departmentId: userData.departmentId || null,
                locationId: userData.locationId, // Add locationId
                updatedAt: new Date() // Add updatedAt since it's required by schema
            };

            // Create user with role if provided
            let newUser;
            if (userData.roleId) {
                newUser = await prisma.users.create({
                    data: {
                        ...userCreateData,
                        roleId: parseInt(userData.roleId)
                    },
                    include: {
                        roles: true,
                        departments: true
                    }
                });
            } else {
                newUser = await prisma.users.create({
                    data: userCreateData,
                    include: {
                        roles: true,
                        departments: true
                    }
                });
            }
            
            return newUser;
        } catch (error) {
            console.error('💥 === USERDB.ADDUSER FAILED ===');
            console.error('❌ Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code
            });
            
            // Handle specific Prisma errors
            if (error.code === 'P2002') {
                if (error.message.includes('username')) {
                    throw new Error('Username already exists');
                } else if (error.message.includes('email')) {
                    throw new Error('Email already exists');
                } else if (error.message.includes('id')) {
                    throw new Error('Database error: ID constraint violation. Please contact administrator.');
                } else {
                    throw new Error('A record with this information already exists');
                }
            } else if (error.code === 'P2003') {
                throw new Error('Invalid reference data provided');
            }
            
            throw error;
        }
    }

    static async getUserById(userId) {
        try {
            return await prisma.users.findUnique({
                where: { id: userId },
                include: {
                    roles: true,
                    departments: true,
                    user_permissions: {
                        include: {
                            permissions: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error(' UserDB.getUserById: Database error:', error);
            throw error;
        }
    }

    static async updateUser(userId, userData) {
        try {
            // If password is being updated, hash it
            if (userData.password) {
                const saltRounds = 10;
                userData.password = await bcrypt.hash(userData.password, saltRounds);
                userData.passwordChangedAt = new Date();
            }

            return await prisma.users.update({
                where: { id: userId },
                data: userData,
                include: {
                    roles: true,
                    departments: true
                }
            });
        } catch (error) {
            console.error(' UserDB.updateUser: Database error:', error);
            throw error;
        }
    }

    static async deleteUser(userId) {
        try {
            return await prisma.users.delete({
                where: { id: userId }
            });
        } catch (error) {
            console.error(' UserDB.deleteUser: Database error:', error);
            throw error;
        }
    }

    
    static async getAllRoles() {
        try {
            const roles = await prisma.roles.findMany({
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
            return roles;
        } catch (error) {
            console.error(' UserDB.getAllRoles: Database error:', error);
            throw error;
        }
    }

    // Get all locations for dropdown
    static async getAllLocations() {
        try {
            const locations = await prisma.locations.findMany({
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
            return locations;
        } catch (error) {
            console.error(' UserDB.getAllLocations: Database error:', error);
            throw error;
        }
    }
}

export default UserDB; 