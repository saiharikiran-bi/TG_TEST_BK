import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class RoleDB {
    static async getAllRoles(locationId = null, page = 1, limit = 10, search = '') {
        try {
            const skip = (page - 1) * limit;
            let whereClause = {};
            
            // Add search functionality
            if (search && search.trim()) {
                whereClause.name = {
                    contains: search.trim(),
                    mode: 'insensitive'
                };
            }
            
            // If locationId is provided, filter roles by users in that location
            if (locationId) {
                whereClause.users = {
                    some: {
                        locationId: locationId
                    }
                };
            }
            
            // Get total count for pagination
            const total = await prisma.roles.count({ where: whereClause });
            
            const roles = await prisma.roles.findMany({
                where: whereClause,
                include: {
                    users: {
                        where: locationId ? { locationId: locationId } : {},
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            isActive: true
                        }
                    },
                    role_permissions: {
                        include: {
                            permissions: true
                        }
                    }
                },
                orderBy: { id: 'asc' },
                skip,
                take: limit
            });
            
            return {
                data: roles,
                total,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalCount: total,
                    limit,
                    hasNextPage: page < Math.ceil(total / limit),
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            console.error('Error getting all roles:', error);
            throw error;
        }
    }

    static async addRole(roleData) {
        try {
            if (!roleData.name) {
                throw new Error('Role name is required');
            }

            const existingRole = await prisma.roles.findUnique({
                where: { name: roleData.name }
            });
            if (existingRole) {
                throw new Error('Role name already exists');
            }

            let newRole;
            if (roleData.permissionIds && roleData.permissionIds.length > 0) {
                newRole = await prisma.roles.create({
                    data: {
                        name: roleData.name,
                        level: roleData.level || 1, // Default level to 1 if not provided
                        accessLevel: roleData.accessLevel || 'NORMAL', // Default accessLevel to NORMAL if not provided
                        updatedAt: new Date(), // Add current date for updatedAt
                        role_permissions: {
                            create: roleData.permissionIds.map(permissionId => ({
                                permissionId: parseInt(permissionId)
                            }))
                        }
                    },
                    include: {
                        users: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                isActive: true
                            }
                        },
                        role_permissions: {
                            include: {
                                permissions: true
                            }
                        }
                    }
                });
            } else {
                newRole = await prisma.roles.create({
                    data: {
                        name: roleData.name,
                        level: roleData.level || 1, // Default level to 1 if not provided
                        accessLevel: roleData.accessLevel || 'NORMAL', // Default accessLevel to NORMAL if not provided
                        updatedAt: new Date() // Add current date for updatedAt
                    },
                    include: {
                        users: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                isActive: true
                            }
                        },
                        role_permissions: {
                            include: {
                                permissions: true
                            }
                        }
                    }
                });
            }
            
            return newRole;
        } catch (error) {
            console.error(' RoleDB.addRole: Database error:', error);
            throw error;
        }
    }

    static async getRoleById(roleId) {
        try {
            return await prisma.roles.findUnique({
                where: { id: roleId },
                include: {
                    users: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            isActive: true
                        }
                    },
                    role_permissions: {
                        include: {
                            permissions: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error(' RoleDB.getRoleById: Database error:', error);
            throw error;
        }
    }

    static async updateRole(roleId, roleData) {
        try {
            if (roleData.name) {
                const existingRole = await prisma.roles.findFirst({
                    where: {
                        name: roleData.name,
                        id: { not: roleId }
                    }
                });
                if (existingRole) {
                    throw new Error('Role name already exists');
                }
            }

            const updateData = {
                ...roleData,
                level: roleData.level || 1,
                accessLevel: roleData.accessLevel || 'NORMAL',
                updatedAt: new Date() // Always update the updatedAt timestamp
            };

            return await prisma.roles.update({
                where: { id: roleId },
                data: updateData,
                include: {
                    users: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            isActive: true
                        }
                    },
                    role_permissions: {
                        include: {
                            permissions: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error(' RoleDB.updateRole: Database error:', error);
            throw error;
        }
    }

    static async deleteRole(roleId) {
        try {
            const usersWithRole = await prisma.users.findMany({
                where: { roleId }
            });

            if (usersWithRole.length > 0) {
                throw new Error('Cannot delete role that is assigned to users');
            }

            return await prisma.roles.delete({
                where: { id: roleId }
            });
        } catch (error) {
            console.error(' RoleDB.deleteRole: Database error:', error);
            throw error;
        }
    }

    static async assignPermissionsToRole(roleId, permissionIds) {
        try {
            await prisma.role_permissions.deleteMany({
                where: { roleId }
            });

            if (permissionIds && permissionIds.length > 0) {
                await prisma.role_permissions.createMany({
                    data: permissionIds.map(permissionId => ({
                        roleId,
                        permissionId: parseInt(permissionId)
                    }))
                });
            }

            return await this.getRoleById(roleId);
        } catch (error) {
            console.error(' RoleDB.assignPermissionsToRole: Database error:', error);
            throw error;
        }
    }

    
}

export default RoleDB; 