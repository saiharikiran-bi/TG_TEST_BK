import { PrismaClient } from '@prisma/client';
import { getDateInYMDFormat } from '../utils/utils.js';

const prisma = new PrismaClient();

class MeterDB {
    static async getAllMeters() {
        try {
            const meters = await prisma.meters.findMany({
                include: {
                    locations: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            address: true
                        }
                    },
                    meter_configurations: true,
                    dtrs: {
                        select: {
                            id: true,
                            dtrNumber: true
                        }
                    },
                    meter_readings: {
                        orderBy: { readingDate: 'desc' },
                        take: 10
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return meters;
        } catch (error) {
            console.error('Error getting all meters:', error);
            throw error;
        }
    }

    static async findByMeterNumber(meterNumber) {
        try {
            const meter = await prisma.meters.findUnique({
                where: {meterNumber: meterNumber }, // Search by meterNumber instead of ID
                include: {
                    locations: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            address: true,
                            pincode: true,
                            latitude: true,
                            longitude: true
                        }
                    },
                    meter_configurations: true,
                    dtrs: {
                        select: {
                            id: true,
                            dtrNumber: true,
                            capacity: true,
                            type: true
                        }
                    },
                    bills: {
                        include: {
                            consumers: {
                                select: {
                                    id: true,
                                    name: true,
                                    consumerNumber: true
                                }
                            }
                        },
                        take: 1,
                        orderBy: { createdAt: 'desc' }
                    },
                    // Skip transformers for now due to schema issues
                    // current_transformers: true,
                    // potential_transformers: true,
                    meter_readings: {
                        orderBy: { readingDate: 'desc' },
                        take: 10
                    }
                }
            });
            return meter;
        } catch (error) {
            console.error('Error finding meter by meter number:', error);
            throw error;
        }
    }

    static async findBySerialNumber(serialNumber) {
        try {
            const meter = await prisma.meters.findUnique({
                where: { serialNumber }
            });
            return meter;
        } catch (error) {
            console.error('Error finding meter by serial number:', error);
            throw error;
        }
    }

    // Create new meter
    static async create(meterData) {
        try {
            // Check if meter already exists
            const existingMeterBySerial = await this.findBySerialNumber(meterData.serialNumber);
            
            if (existingMeterBySerial) {
                throw new Error('Meter already exists with this serial number');
            }

            const newMeter = await prisma.meters.create({
                data: {
                    meterNumber: meterData.meterNumber,
                    serialNumber: meterData.serialNumber,
                    manufacturer: meterData.manufacturer,
                    model: meterData.model,
                    type: meterData.type,
                    phase: parseInt(meterData.phase),
        
                    locationId: parseInt(meterData.locationId),
                    installationDate: new Date(getDateInYMDFormat(new Date(meterData.installationDate))),
                    dtrId: meterData.dtrId ? parseInt(meterData.dtrId) : null,
                    status: 'ACTIVE',
                    isInUse: true
                }
            });

            return newMeter;
        } catch (error) {
            console.error('Error creating meter:', error);
            throw error;
        }
    }

    static async updateMeter(id, updateData) {
        try {
            const updatedMeter = await prisma.meters.update({
                where: { id: parseInt(id) },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return updatedMeter;
        } catch (error) {
            console.error('Error updating meter:', error);
            throw error;
        }
    }

    static async deleteMeter(id) {
        try {
            const deletedMeter = await prisma.meters.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'DECOMMISSIONED',
                    isInUse: false,
                    decommissionDate: new Date()
                }
            });
            return deletedMeter;
        } catch (error) {
            console.error('Error deleting meter:', error);
            throw error;
        }
    }


    static async getMeterStats() {
        try {
            const totalMeters = await prisma.meters.count();
            const makes = await prisma.meters.groupBy({
                by: ['manufacturer'],
                _count: { manufacturer: true }
            });
            const types = await prisma.meters.groupBy({
                by: ['type'],
                _count: { type: true }
            });
            
            // Get connection types from meter types since we don't have bills table
            const connectionTypes = await prisma.meters.groupBy({
                by: ['type'],
                _count: { type: true }
            });
            
            const connTypeCounts = {};
            connectionTypes.forEach(ct => {
                if (ct.type) {
                    connTypeCounts[ct.type] = ct._count.type;
                }
            });

            return {
                totalMeters,
                makes: makes.map(m => ({ manufacturer: m.manufacturer, count: m._count.manufacturer })),
                types: types.map(t => ({ type: t.type, count: t._count.type })),
                connectionTypes: connTypeCounts
            };
        } catch (error) {
            console.error('MeterDB.getMeterStats: Database error:', error);
            throw error;
        }
    }

    static async getMeterView(meterId) {
        try {
            const meter = await prisma.meters.findUnique({
                where: { id: parseInt(meterId) },
                include: {
                    meter_configurations: true,
                    locations: true,
                    dtrs: true,
                    meter_readings: {
                        orderBy: { readingDate: 'desc' },
                        take: 10
                    }
                }
            });
            if (!meter) throw new Error('Meter not found');
            return meter;
        } catch (error) {
            console.error(' MeterDB.getMeterView: Database error:', error);
            throw error;
        }
    }

    static async getMetersTable(page = 1, limit = 10, filters = {}) {
        try {
            const skip = (page - 1) * limit;
            const whereClause = {};
            if (filters.meterNumber) {
                whereClause.meterNumber = { contains: filters.meterNumber, mode: 'insensitive' };
            }
            if (filters.serialNumber) {
                whereClause.serialNumber = { contains: filters.serialNumber, mode: 'insensitive' };
            }
            if (filters.manufacturer) {
                whereClause.manufacturer = { contains: filters.manufacturer, mode: 'insensitive' };
            }
            if (filters.type) {
                whereClause.type = filters.type;
            }
            if (filters.status) {
                whereClause.status = filters.status;
            }
            if (filters.location) {
                whereClause.locations = {
                    name: { contains: filters.location, mode: 'insensitive' }
                };
            }
            const totalCount = await prisma.meters.count({ where: whereClause });

            const meters = await prisma.meters.findMany({
                where: whereClause,
                include: {
                    bills: {
                        include: {
                            consumers: {
                                select: {
                                    name: true
                                }
                            }
                        },
                        take: 1,
                        orderBy: { createdAt: 'desc' }
                    },
                    locations: {
                        select: {
                            name: true,
                            code: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            });

            const totalPages = Math.ceil(totalCount / limit);

            const result = {
                data: meters,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
            return result;
        } catch (error) {
            console.error(' MeterDB.getMeterStats: Database error:', error);
            throw error;
        }
    }

    static async getDataLoggersList() {
        try {
            const dataLoggers = await prisma.modems.findMany({
                where: {
                    meters: {
                        isNot: null
                    }
                },
                include: {
                    meters: {
                        select: {
                            id: true,
                            meterNumber: true,
                            serialNumber: true,
                            manufacturer: true,
                            model: true,
                            type: true,
                            status: true,
                            installationDate: true,
                            bills: {
                                include: {
                                    consumers: {
                                        select: {
                                            consumerNumber: true,
                                            name: true,
                                            primaryPhone: true,
                                            email: true
                                        }
                                    }
                                },
                                take: 1,
                                orderBy: { createdAt: 'desc' }
                            },
                            locations: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                    address: true
                                }
                            }
                        }
                    }
                },
                orderBy: { modem_id: 'desc' }
            });

            return dataLoggers;
        } catch (error) {
            console.error(' MeterDB.getDataLoggersList: Database error:', error);
            throw error;
        }
    }

    static async getMeterHistory(meterId) {
        try {
            const meter = await prisma.meters.findUnique({
                where: { id: parseInt(meterId) },
                include: {
                    bills: {
                        include: {
                            consumers: {
                                select: {
                                    name: true
                                }
                            }
                        },
                        take: 1,
                        orderBy: { createdAt: 'desc' }
                    },
                    locations: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    modems: true
                }
            });

            if (!meter) {
                throw new Error('Meter not found');
            }

            return {
                id: meter.id,
                meterNumber: meter.meterNumber,
                serialNumber: meter.serialNumber,
                manufacturer: meter.manufacturer,
                model: meter.model,
                type: meter.type,
                status: meter.status,
                installationDate: meter.installationDate,
                location: meter.location,
                modem: meter.modem
            };
        } catch (error) {
            console.error(' MeterDB.getMeterHistory: Database error:', error);
            throw error;
        }
    }
}

export default MeterDB;