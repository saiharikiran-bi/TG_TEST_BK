import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class AssetDB {
    static async getAllAssets(userLocationId = null) {
        try {
            // Get all locations with their types
            const allLocations = await prisma.locations.findMany({
                include: {
                    location_types: true
                },
                orderBy: { createdAt: 'desc' }
            });

            if (userLocationId) {
            }

            // Create a map for quick lookup
            const locationMap = new Map();
            const rootLocations = [];

            // First pass: create all location objects
            allLocations.forEach(location => {
                locationMap.set(location.id, {
                    hierarchy_id: location.id,
                    hierarchy_name: location.name,
                    hierarchy_type_title: location.location_types?.name || 'Unknown',
                    children: []
                });
            });

            // Second pass: build the hierarchy
            allLocations.forEach(location => {
                const locationObj = locationMap.get(location.id);
                
                if (location.parentId === null) {
                    // This is a root location
                    rootLocations.push(locationObj);
                } else {
                    // This is a child location
                    const parent = locationMap.get(location.parentId);
                    if (parent) {
                        parent.children.push(locationObj);
                    }
                }
            });

            
            // If user location filtering is requested, filter the results
            if (userLocationId) {
                const userLocation = allLocations.find(loc => loc.id === userLocationId);
                if (userLocation) {
                    // Find the user's location in the hierarchy and return only that branch
                    const userLocationInHierarchy = this.findLocationInHierarchy(rootLocations, userLocationId);
                    if (userLocationInHierarchy) {
                        return [userLocationInHierarchy];
                    }
                } else {
                }
            }

            return rootLocations;
        } catch (error) {
            console.error('Error getting all assets:', error);
            throw error;
        }
    }

    // Helper method to find a location in the hierarchy
    static findLocationInHierarchy(nodes, locationId) {
        for (const node of nodes) {
            if (node.hierarchy_id === locationId) {
                return node;
            }
            if (node.children && node.children.length > 0) {
                const found = this.findLocationInHierarchy(node.children, locationId);
                if (found) return found;
            }
        }
        return null;
    }

    static async addAsset(data) {
        try {
            
            let parentLocationId = null;

            // Set default parent_location to null if empty
            if (!data.parent_location) {
                data.parent_location = null;
            }

            // If locationId is provided (from user's location), use it as parent
            if (data.locationId) {
                parentLocationId = data.locationId;
            } else if (data.parent_location && data.parent_location !== '0') {
                const parentLocation = await prisma.locations.findFirst({
                    where: {
                        name: data.parent_location
                    }
                });

                if (!parentLocation) {
                    throw new Error(
                        `Parent location '${data.parent_location}' not found`
                    );
                }

                parentLocationId = parentLocation.id;
            }


            // If only location_type_name is provided
            if (
                data.location_type_name &&
                (!data.location_names || data.location_names.length === 0)
            ) {
                const existingLocationType = await prisma.location_types.findFirst({
                    where: {
                        name: data.location_type_name
                    }
                });

                if (existingLocationType) {
                    return {
                        status: 'warning',
                        message: 'Location type already exists',
                        location_type_id: existingLocationType.id,
                        location_id: null,
                    };
                }

                // Create new location type if it doesn't exist
                const newLocationType = await prisma.location_types.create({
                    data: {
                        name: data.location_type_name
                    }
                });
                return {
                    status: 'success',
                    message: 'Location type added successfully',
                    location_type_id: newLocationType.id,
                    location_id: null,
                };
            }

            // Handle case with location_names
            if (data.location_names && data.location_names.length > 0) {
                if (!data.location_type_name) {
                    throw new Error(
                        'location_type_name is required when inserting location names'
                    );
                }

                let locationTypeId = null;

                // Check if location type exists
                const existingLocationType = await prisma.location_types.findFirst({
                    where: {
                        name: data.location_type_name
                    }
                });

                if (!existingLocationType) {
                    // Create new location type
                    const newLocationType = await prisma.location_types.create({
                        data: {
                            name: data.location_type_name
                        }
                    });
                    locationTypeId = newLocationType.id;
                } else {
                    locationTypeId = existingLocationType.id;
                }

                if (locationTypeId === null) {
                    throw new Error(
                        'Failed to determine location_type_id for the provided location_type_name'
                    );
                }

                const results = [];
                for (const locationName of data.location_names) {
                    // Check if location name already exists
                    const existingLocation = await prisma.locations.findFirst({
                        where: {
                            name: locationName,
                            parentId: parentLocationId,
                            locationTypeId: locationTypeId
                        }
                    });

                    if (existingLocation) {
                        results.push({
                            name: locationName,
                            status: 'warning',
                            message: 'Location already exists',
                            location_id: existingLocation.id,
                        });
                        continue;
                    }

                    // Insert new location
                    const newLocation = await prisma.locations.create({
                        data: {
                            name: locationName,
                            code: locationName,
                            locationTypeId: locationTypeId,
                            parentId: parentLocationId,
                            updatedAt: new Date()
                        }
                    });

                    results.push({
                        name: locationName,
                        status: 'success',
                        message: 'Location added successfully',
                        location_id: newLocation.id,
                    });
                }
                return {
                    status: 'success',
                    message: 'Locations and location type processed',
                    location_type_id: locationTypeId,
                    locations_results: results,
                };
            }

            throw new Error(
                'No valid data provided for insertion. Please provide location_type_name or location_names.'
            );
        } catch (error) {
            console.error('addAsset error:', error);
            throw error;
        }
    }

    static async bulkUploadAssets(assetsData) {
        try {
            const results = {
                total: assetsData.length,
                successful: 0,
                failed: 0,
                warnings: 0,
                details: []
            };

            for (const assetData of assetsData) {
                try {
                    const result = await this.addAsset(assetData);
                    
                    if (result.status === 'success') {
                        results.successful++;
                    } else if (result.status === 'warning') {
                        results.warnings++;
                    }
                    
                    results.details.push({
                        data: assetData,
                        result: result
                    });
                } catch (error) {
                    results.failed++;
                    results.details.push({
                        data: assetData,
                        error: error.message,
                        status: 'error'
                    });
                }
            }

            return {
                status: 'completed',
                message: `Bulk upload completed. ${results.successful} successful, ${results.warnings} warnings, ${results.failed} failed.`,
                summary: results
            };
        } catch (error) {
            console.error('bulkUploadAssets error:', error);
            throw error;
        }
    }
}

export default AssetDB; 