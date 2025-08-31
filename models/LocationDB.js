import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class LocationDB {
    async getFilterOptions(parentId = null, locationTypeId = null) {
        try {
            let whereClause = {};
            
            if (parentId) {
                whereClause.parentId = parseInt(parentId);
            } else if (locationTypeId) {
                whereClause.locationTypeId = parseInt(locationTypeId);
            } else {
                // If no parentId or locationTypeId, get top-level locations (DISCOM level)
                whereClause.parentId = null;
            }

            const locations = await prisma.locations.findMany({
                where: whereClause,
                include: {
                    location_types: {
                        select: {
                            name: true,
                            level: true
                        }
                    }
                },
                orderBy: {
                    name: 'asc'
                }
            });

            return locations.map(location => ({
                id: location.id,
                name: location.name,
                code: location.code,
                locationTypeId: location.locationTypeId,
                parentId: location.parentId,
                level: location.location_types.level,
                levelName: location.location_types.name
            }));
        } catch (error) {
            console.error('Error in getFilterOptions:', error);
            throw error;
        }
    }

    async getHierarchyLevels() {
        try {
            const levels = await prisma.location_types.findMany({
                where: {
                    isActive: true
                },
                orderBy: {
                    level: 'asc'
                },
                select: {
                    id: true,
                    name: true,
                    level: true,
                    description: true
                }
            });

            return levels;
        } catch (error) {
            console.error('Error in getHierarchyLevels:', error);
            throw error;
        }
    }

    async getLocationById(id) {
        try {
            const location = await prisma.locations.findUnique({
                where: { id: parseInt(id) },
                include: {
                    location_types: {
                        select: {
                            name: true,
                            level: true
                        }
                    }
                }
            });

            return location;
        } catch (error) {
            console.error('Error in getLocationById:', error);
            throw error;
        }
    }
}

export default LocationDB;
