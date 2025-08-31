import { PrismaClient } from '@prisma/client';
import { getDateInYMDFormat } from '../utils/utils.js';

const prisma = new PrismaClient();

class DTRDB {
    static async getDTRTable({ page = 1, pageSize = 20, search = '', status, locationId } = {}) {
        const skip = (page - 1) * pageSize;
        const where = {};

        if (search) {
            where.OR = [
                { dtrNumber: { contains: search, mode: 'insensitive' } },
                { serialNumber: { contains: search, mode: 'insensitive' } },
                { manufacturer: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (status) {
            where.status = status;
        }
        if (locationId) {
            where.locationId = locationId;
        }

        const [total, data] = await Promise.all([
            prisma.dtrs.count({ where }),
            prisma.dtrs.findMany({
                where,
                include: {
                    locations: {
                        include: {
                            location_types: {
                                select: {
                                    name: true,
                                    level: true
                                }
                            }
                        }
                    }
                },
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        // Get feeders count and latest communication date for each DTR
        const dtrsWithFeedersCount = await Promise.all(
            data.map(async (dtr) => {
                const feedersCount = await prisma.meters.count({
                    where: { dtrId: dtr.id }
                });

                // Get latest reading date for this DTR's meters
                const meters = await prisma.meters.findMany({
                    where: { dtrId: dtr.id },
                    select: { id: true }
                });

                let lastCommunication = null;
                if (meters.length > 0) {
                    const meterIds = meters.map(m => m.id);
                    const latestReading = await prisma.meter_readings.findFirst({
                        where: {
                            meterId: { in: meterIds }
                        },
                        orderBy: { readingDate: 'desc' },
                        select: { readingDate: true }
                    });
                    
                    // Convert to local time in IST timezone for consistent frontend display
                    if (latestReading?.readingDate) {
                        // Extract the time components from the UTC date and treat them as local time
                        const utcDate = new Date(latestReading.readingDate);
                        
                        // Get the time components (treating them as local time, not UTC)
                        const year = utcDate.getUTCFullYear();
                        const month = utcDate.getUTCMonth();
                        const day = utcDate.getUTCDate();
                        const hour = utcDate.getUTCHours();
                        const minute = utcDate.getUTCMinutes();
                        const second = utcDate.getUTCSeconds();
                        
                        // Create a new date object with these components in local timezone
                        const localDate = new Date(year, month, day, hour, minute, second);
                        
                        // Format as a standardized string that JavaScript can parse
                        const formattedDate = localDate.toLocaleString('en-IN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                        });
                        
                        // Send ISO string that JavaScript can definitely parse
                        lastCommunication = localDate.toISOString();
                    }
                }

                return {
                    ...dtr,
                    feedersCount,
                    lastCommunication
                };
            })
        );

        return {
            data: dtrsWithFeedersCount,
            total,
            page,
            pageSize
        };
    }

    // Helper method to resolve DTR ID consistently
    static async resolveDTRId(dtrId) {
        // Validate input parameter
        if (!dtrId && dtrId !== 0) {
            throw new Error('DTR ID is required');
        }

        // If the input looks like a partial DTR number (e.g., "002", "201"), 
        // prioritize string-based searches over numeric ID searches
        if (dtrId && typeof dtrId === 'string' && dtrId.length <= 5) {
            // Try to find by exact dtrNumber match first
            let dtr = await prisma.dtrs.findFirst({
                where: { dtrNumber: dtrId }
            });
            if (dtr) {
                return dtr;
            }

            // Try to find by dtrNumber ending with the provided value
            dtr = await prisma.dtrs.findFirst({
                where: {
                    dtrNumber: {
                        endsWith: dtrId.toString()
                    }
                }
            });
            if (dtr) {
                return dtr;
            }
        }

        // Try to find DTR by ID (both as integer and string) - only for longer inputs
        const parsedId = parseInt(dtrId);
        if (!isNaN(parsedId) && parsedId > 0) {
            let dtr = await prisma.dtrs.findUnique({
                where: { id: parsedId }
            });
            if (dtr) {
                return dtr;
            }
        }

        // If not found by parsed integer, try by dtrNumber
        if (dtrId && typeof dtrId === 'string') {
            let dtr = await prisma.dtrs.findFirst({
                where: { dtrNumber: dtrId }
            });
            if (dtr) return dtr;
        }

        // If still not found, try to find by dtrNumber ending with the provided value
        // This handles cases where frontend sends "002" but DB stores "DTR-002"
        if (dtrId && typeof dtrId === 'string') {
            let dtr = await prisma.dtrs.findFirst({
                where: {
                    dtrNumber: {
                        endsWith: dtrId.toString()
                    }
                }
            });
            if (dtr) {
                return dtr;
            }
        }

        // If still not found, try to find by partial dtrNumber match (most specific)
        // This handles cases where frontend sends "201" but DB stores "DTR-201"
        if (dtrId && typeof dtrId === 'string') {
            let dtr = await prisma.dtrs.findFirst({
                where: {
                    dtrNumber: {
                        contains: dtrId.toString()
                    }
                }
            });
            if (dtr) {
                return dtr;
            }
        }

        throw new Error(`DTR not found with ID or number: ${dtrId}`);
    }

    static async getFeedersForDTR(dtrId) {
        try {
            const dtr = await DTRDB.resolveDTRId(dtrId);

            const feedersRaw = await prisma.meters.findMany({
                where: { dtrId: dtr.id },
                select: {
                    id: true,
                    meterNumber: true,
                    serialNumber: true,
                    manufacturer: true,
                    model: true,
                    type: true,
                    phase: true,
                    status: true,
                    locationId: true
                }
            });

            const locationIds = [...new Set(feedersRaw.map(f => f.locationId))];
            
            // Fetch complete location hierarchy for each location
            const locationsWithHierarchy = await Promise.all(
                locationIds.map(async (locationId) => {
                    if (!locationId) return null;
                    
                    // Get the location and its complete hierarchy
                    const location = await prisma.locations.findUnique({
                        where: { id: locationId },
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            latitude: true,
                            longitude: true,
                            address: true,
                            locationTypeId: true,
                            parentId: true,
                            location_types: {
                                select: {
                                    name: true,
                                    level: true
                                }
                            }
                        }
                    });
                    
                    if (!location) return null;
                    
                    // Build the complete hierarchy path
                    const hierarchy = await DTRDB.buildLocationHierarchy(locationId);
                    
                    return {
                        ...location,
                        hierarchy
                    };
                })
            );
            
            const locationMap = Object.fromEntries(
                locationsWithHierarchy
                    .filter(Boolean)
                    .map(loc => [loc.id, loc])
            );

            const feeders = feedersRaw.map(f => ({
                ...f,
                location: locationMap[f.locationId] || null
            }));

            // Get the latest communication date for this DTR's meters
            const meterIds = feedersRaw.map(f => f.id);
            let lastCommunication = null;
            
            if (meterIds.length > 0) {
                const latestReading = await prisma.meter_readings.findFirst({
                    where: {
                        meterId: { in: meterIds }
                    },
                    orderBy: { readingDate: 'desc' },
                    select: { readingDate: true }
                });
                
                if (latestReading?.readingDate) {
                    // Convert to local time in IST timezone for consistent frontend display
                    const utcDate = new Date(latestReading.readingDate);
                    
                    // Get the time components (treating them as local time, not UTC)
                    const year = utcDate.getUTCFullYear();
                    const month = utcDate.getUTCMonth();
                    const day = utcDate.getUTCDate();
                    const hour = utcDate.getUTCHours();
                    const minute = utcDate.getUTCMinutes();
                    const second = utcDate.getUTCSeconds();
                    
                    // Create a new date object with these components in local timezone
                    const localDate = new Date(year, month, day, hour, minute, second);
                    
                    // Send ISO string that JavaScript can definitely parse
                    lastCommunication = localDate.toISOString();
                }
            }

            return {
                dtr: {
                    id: dtr.id,
                    dtrNumber: dtr.dtrNumber,
                    serialNumber: dtr.serialNumber,
                    manufacturer: dtr.manufacturer,
                    model: dtr.model,
                    capacity: dtr.capacity,
                    loadPercentage: dtr.loadPercentage,
                    status: dtr.status,
                    lastCommunication: lastCommunication
                },
                feeders: feeders
            };
        } catch (error) {
            console.error(`Error fetching feeders for DTR ${dtrId}:`, error);
            throw error;
        }
    }

    static async getDTRAlerts(locationId = null) {
        try {
            const where = {};
            
            // If locationId is provided, filter by location
            if (locationId) {
                where.dtrs = {
                    locationId: locationId
                };
            }
            
            const alerts = await prisma.dtr_faults.findMany({
                where,
                include: {
                    dtrs: {
                        include: {
                            locations: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return alerts;
        } catch (error) {
            console.error('Error fetching DTR alerts:', error);
            throw error;
        }
    }



    static async getDTRAlertsTrends(locationId = null) {
        try {
            const today = new Date();
            const months = [];
            for (let i = 0; i < 12; i++) {
                const date = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
                months.push({
                    month: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
                });
            }

            // Build where clause for escalation notifications
            let whereClause = {};
            
            if (locationId) {
                whereClause = {
                    meters: {
                        dtrs: {
                    locationId: locationId
                        }
                    }
                };
            }

            // Get all escalation notifications for the last 12 months with alert types
            const notifications = await prisma.escalation_notifications.findMany({
                where: whereClause,
                select: {
                    type: true,
                    abnormalitytype: true,
                    createdat: true
                }
            });

            // Get unique alert types from the database and clean them up
            const rawAlertTypes = notifications.map(n => n.abnormalitytype || n.type).filter(Boolean);
            
            // Clean up alert types to remove common prefixes and simplify
            const cleanAlertType = (alertType) => {
                if (!alertType) return null;
                
                let cleaned = alertType
                    .replace(/^HT\s+Fuse\s+Blown\s*\([^)]+\)/i, 'HT Fuse Blown') // Simplify "HT Fuse Blown (R - Phase)"
                    .replace(/^\s+|\s+$/g, '') // Trim whitespace
                    .replace(/^,\s*/, '') // Remove leading comma
                    .replace(/,\s*$/, ''); // Remove trailing comma
                
                // If we ended up with empty string after cleaning, use a fallback
                if (!cleaned || cleaned.trim() === '') {
                    cleaned = 'Abnormality Detected';
                }
                
                return cleaned;
            };
            
            const alertTypes = [...new Set(rawAlertTypes.map(cleanAlertType).filter(Boolean))];

            // Map months to trends data based on actual alert types
            const trendsData = months.map(monthData => {
                const monthNotifications = notifications.filter(notification => {
                    if (!notification.createdat) return false;
                    
                    const notificationDate = new Date(notification.createdat);
                    const notificationMonth = notificationDate.getFullYear() + '-' + String(notificationDate.getMonth() + 1).padStart(2, '0');
                    return notificationMonth === monthData.month;
                });

                // Create dynamic object with actual alert types
                const result = { month: monthData.month };
                
                // Count by actual alert types
                alertTypes.forEach(alertType => {
                    const count = monthNotifications.filter(n => {
                        const rawType = n.abnormalitytype || n.type;
                        if (!rawType) return false;
                        
                        // Clean the raw type and compare with the cleaned alert type
                        const cleanedRawType = cleanAlertType(rawType);
                        return cleanedRawType === alertType;
                    }).length;
                    
                    result[alertType.toLowerCase().replace(/\s+/g, '_') + '_count'] = count;
                });

                return result;
            });

            // If no data found, return dummy data for testing
            if (notifications.length === 0) {
                return months.map(monthData => ({
                    month: monthData.month,
                    lt_fuse_blown_count: Math.floor(Math.random() * 10),
                    ht_fuse_blown_count: Math.floor(Math.random() * 5),
                    overload_count: Math.floor(Math.random() * 3),
                    underload_count: Math.floor(Math.random() * 2),
                    power_failure_count: Math.floor(Math.random() * 4)
                }));
            }
            
            return trendsData;
        } catch (error) {
            console.error('Error fetching DTR alerts trends:', error);
            throw error;
        }
    }



    static async getDTRStats() {
        try {
            const totalDTRs = await prisma.dtrs.count();
            const totalLTFeeders = await prisma.meters.count();

            // Active/Inactive DTRs
            const activeDTRs = await prisma.dtrs.count({ where: { status: 'ACTIVE' } });
            const inactiveDTRs = await prisma.dtrs.count({ where: { status: 'INACTIVE' } });

            const meterIds = (await prisma.meters.findMany({ select: { id: true } })).map(m => m.id);
            const latestReadings = await Promise.all(
                meterIds.map(async meterId =>
                    await prisma.meter_readings.findFirst({
                        where: { meterId },
                        orderBy: { readingDate: 'desc' }
                    })
                )
            );
            const readingsArr = latestReadings.filter(Boolean);

            const ltFuseBlown = readingsArr.filter(r =>
                (r.currentR === 0 || r.currentY === 0 || r.currentB === 0)
            ).length;

            // Count HT Fuse Blown as incidents per meter, not per reading
            const htFuseBlownMeters = new Set();
            readingsArr.forEach(r => {
                if ((r.voltageR !== null && r.voltageR < 180) ||
                (r.voltageY !== null && r.voltageY < 180) ||
                    (r.voltageB !== null && r.voltageB < 180)) {
                    // Get the meter ID for this reading
                    const meterId = r.meterId;
                    if (meterId) {
                        htFuseBlownMeters.add(meterId);
                    }
                }
            });
            const htFuseBlown = htFuseBlownMeters.size;

            const totalFuseBlown = ltFuseBlown + htFuseBlown;

            const overloadedDTRs = await prisma.dtrs.count({
                where: {
                    loadPercentage: { gt: 90 }
                }
            });

            const underloadedDTRs = await prisma.dtrs.count({
                where: {
                    loadPercentage: { lt: 30 }
                }
            });

            const unbalancedDTRs = readingsArr.filter(r =>
                r.currentB !== null && r.currentB > 15
            ).length;

            const powerFailureFeeders = readingsArr.filter(r =>
                r.powerFactor !== null && r.powerFactor === 0
            ).length;

            // Percentages
            const percent = (num, denom) => denom > 0 ? +(num / denom * 100).toFixed(2) : 0;

            return {
                totalDTRs,
                totalLTFeeders,
                activeDTRs,
                inactiveDTRs,
                totalFuseBlown,
                overloadedDTRs,
                underloadedDTRs,
                ltFuseBlown,
                htFuseBlown,
                unbalancedDTRs,
                powerFailureFeeders,
                percentTotalFuseBlown: percent(totalFuseBlown, totalDTRs),
                percentOverloadedFeeders: percent(overloadedDTRs, totalLTFeeders),
                percentUnderloadedFeeders: percent(underloadedDTRs, totalLTFeeders),
                percentUnbalancedDTRs: percent(unbalancedDTRs, totalDTRs),
                percentPowerFailureFeeders: percent(powerFailureFeeders, totalLTFeeders)
            };
        } catch (error) {
            console.error('Error fetching DTR stats:', error);
            throw error;
        }
    }

    static async getConsumptionStats() {
        try {
            const agg = await prisma.meter_readings.aggregate({
                _sum: {
                    kWh: true,
                    kVAh: true,
                    kW: true,
                    kVA: true
                }
            });
            return {
                totalKWh: agg._sum.kWh || 0,
                totalKVAh: agg._sum.kVAh || 0,
                totalKW: agg._sum.kW || 0,
                totalKVA: agg._sum.kVA || 0
            };
        } catch (error) {
            console.error('Error fetching consumption stats:', error);
            throw error;
        }
    }

    static async getConsolidatedDTRStats(locationId = null) {
        try {
            // Build where clause for DTRs
            const dtrWhere = {};
            if (locationId) {
                dtrWhere.locationId = locationId;
            }
            
            // Get basic DTR stats
            const totalDTRs = await prisma.dtrs.count({ where: dtrWhere });
            
            // Get DTR IDs for this location (if filtering)
            let dtrIds = null;
            if (locationId) {
                const dtrsInLocation = await prisma.dtrs.findMany({
                    where: dtrWhere,
                    select: { id: true }
                });
                dtrIds = dtrsInLocation.map(d => d.id);
            }
            
            // Get total LT feeders
            let totalLTFeeders;
            if (locationId && dtrIds.length > 0) {
                totalLTFeeders = await prisma.meters.count({
                    where: { dtrId: { in: dtrIds } }
                });
            } else {
                totalLTFeeders = await prisma.meters.count();
            }
            
            const activeDTRs = await prisma.dtrs.count({ 
                where: { 
                    status: 'ACTIVE',
                    ...dtrWhere
                } 
            });
            const inactiveDTRs = await prisma.dtrs.count({ 
                where: { 
                    status: 'INACTIVE',
                    ...dtrWhere
                } 
            });

            // Get meter readings for calculations
            let meterIds;
            if (locationId && dtrIds.length > 0) {
                meterIds = (await prisma.meters.findMany({ 
                    where: { dtrId: { in: dtrIds } },
                    select: { id: true } 
                })).map(m => m.id);
            } else {
                meterIds = (await prisma.meters.findMany({ select: { id: true } })).map(m => m.id);
            }
            
            const latestReadings = await Promise.all(
                meterIds.map(async meterId =>
                    await prisma.meter_readings.findFirst({
                        where: { meterId },
                        orderBy: { readingDate: 'desc' }
                    })
                )
            );
            const readingsArr = latestReadings.filter(Boolean);

            // Calculate fuse blown stats
            const ltFuseBlown = readingsArr.filter(r =>
                (r.currentR === 0 || r.currentY === 0 || r.currentB === 0)
            ).length;

            const htFuseBlown = readingsArr.filter(r =>
                (r.voltageR !== null && r.voltageR < 180) ||
                (r.voltageY !== null && r.voltageY < 180) ||
                (r.voltageB !== null && r.voltageB < 180)
            ).length;

            const totalFuseBlown = ltFuseBlown + htFuseBlown;

            // Calculate overloaded/underloaded stats
            const overloadedDTRs = await prisma.dtrs.count({
                where: {
                    loadPercentage: { gt: 90 },
                    ...dtrWhere
                }
            });

            const underloadedDTRs = await prisma.dtrs.count({
                where: {
                    loadPercentage: { lt: 30 },
                    ...dtrWhere
                }
            });

            const unbalancedDTRs = readingsArr.filter(r =>
                r.currentB !== null && r.currentB > 15
            ).length;

            const powerFailureFeeders = readingsArr.filter(r =>
                r.powerFactor !== null && r.powerFactor === 0
            ).length;

            // Calculate percentages
            const percent = (num, denom) => denom > 0 ? +(num / denom * 100).toFixed(2) : 0;

            // Get consumption stats - kWh using consumption calculation (last - first reading), others as simple sum
            let totalKwh = 0, totalKvah = 0, totalKw = 0, totalKva = 0;
            let currentDayKwh = 0, currentDayKvah = 0, currentDayKw = 0, currentDayKva = 0;
            
            if (meterIds.length > 0) {
                // Get current date boundaries (start and end of current day)
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
                
                // For kWh: Get all readings to calculate consumption (last - first)
                const allReadings = await prisma.meter_readings.findMany({
                    where: {
                        meterId: { in: meterIds }
                    },
                    select: {
                        meterId: true,
                        readingDate: true,
                        kWh: true
                    },
                    orderBy: [
                        { meterId: 'asc' },
                        { readingDate: 'asc' }
                    ]
                });

                // Group readings by meter for kWh consumption calculation
                const meterReadings = {};
                allReadings.forEach(reading => {
                    if (!meterReadings[reading.meterId]) {
                        meterReadings[reading.meterId] = [];
                    }
                    meterReadings[reading.meterId].push(reading);
                });

                // Calculate kWh consumption for each meter: last reading - first reading
                Object.values(meterReadings).forEach(meterDayReadings => {
                    if (meterDayReadings.length > 1) {
                        // Sort by reading time to get first and last
                        meterDayReadings.sort((a, b) => new Date(a.readingDate) - new Date(b.readingDate));
                        
                        const firstReading = meterDayReadings[0];
                        const lastReading = meterDayReadings[meterDayReadings.length - 1];
                        
                        // Calculate kWh consumption: last - first
                        const meterKwh = (lastReading.kWh || 0) - (firstReading.kWh || 0);
                        
                        // Only add positive consumption values
                        if (meterKwh >= 0) {
                            totalKwh += meterKwh;
                        }
                    }
                });

                // Calculate current day consumption
                const currentDayReadings = await prisma.meter_readings.findMany({
                    where: {
                        meterId: { in: meterIds },
                        readingDate: {
                            gte: startOfDay,
                            lt: endOfDay
                        }
                    },
                    select: {
                        meterId: true,
                        readingDate: true,
                        kWh: true,
                        kVAh: true,
                        kW: true,
                        kVA: true
                    },
                    orderBy: [
                        { meterId: 'asc' },
                        { readingDate: 'asc' }
                    ]
                });

                // Group current day readings by meter for consumption calculation
                const currentDayMeterReadings = {};
                currentDayReadings.forEach(reading => {
                    if (!currentDayMeterReadings[reading.meterId]) {
                        currentDayMeterReadings[reading.meterId] = [];
                    }
                    currentDayMeterReadings[reading.meterId].push(reading);
                });

                // Calculate current day consumption for each meter: last reading - first reading
                Object.values(currentDayMeterReadings).forEach(meterDayReadings => {
                    if (meterDayReadings.length > 1) {
                        // Sort by reading time to get first and last
                        meterDayReadings.sort((a, b) => new Date(a.readingDate) - new Date(b.readingDate));
                        
                        const firstReading = meterDayReadings[0];
                        const lastReading = meterDayReadings[meterDayReadings.length - 1];
                        
                        // Calculate current day consumption: last - first for each metric
                        const meterCurrentDayKwh = (lastReading.kWh || 0) - (firstReading.kWh || 0);
                        const meterCurrentDayKvah = (lastReading.kVAh || 0) - (firstReading.kVAh || 0);
                        const meterCurrentDayKw = (lastReading.kW || 0) - (firstReading.kW || 0);
                        const meterCurrentDayKva = (lastReading.kVA || 0) - (firstReading.kVA || 0);
                        
                        // Only add positive consumption values
                        if (meterCurrentDayKwh >= 0) {
                            currentDayKwh += meterCurrentDayKwh;
                        }
                        if (meterCurrentDayKvah >= 0) {
                            currentDayKvah += meterCurrentDayKvah;
                        }
                        if (meterCurrentDayKw >= 0) {
                            currentDayKw += meterCurrentDayKw;
                        }
                        if (meterCurrentDayKva >= 0) {
                            currentDayKva += meterCurrentDayKva;
                        }
                    }
                });

                // For other metrics: Use simple aggregation (sum of all readings)
                const agg = await prisma.meter_readings.aggregate({
                    where: {
                        meterId: { in: meterIds }
                    },
                    _sum: {
                        kVAh: true,
                        kW: true,
                        kVA: true
                    }
                });

                totalKvah = agg._sum.kVAh || 0;
                totalKw = agg._sum.kW || 0;
                totalKva = agg._sum.kVA || 0;
            }

            // Format data according to the specified structure
            return {
                row1: {
                    totalDtrs: totalDTRs,
                    totalLtFeeders: totalLTFeeders,
                    totalFuseBlown: totalFuseBlown,
                    fuseBlownPercentage: percent(totalFuseBlown, totalDTRs),
                    overloadedFeeders: overloadedDTRs,
                    overloadedPercentage: percent(overloadedDTRs, totalLTFeeders),
                    underloadedFeeders: underloadedDTRs,
                    underloadedPercentage: percent(underloadedDTRs, totalLTFeeders),
                    ltSideFuseBlown: ltFuseBlown,
                    unbalancedDtrs: unbalancedDTRs,
                    unbalancedPercentage: percent(unbalancedDTRs, totalDTRs),
                    powerFailureFeeders: powerFailureFeeders,
                    powerFailurePercentage: percent(powerFailureFeeders, totalLTFeeders),
                    htSideFuseBlown: htFuseBlown,
                    activeDtrs: activeDTRs,
                    activePercentage: percent(activeDTRs, totalDTRs),
                    inactiveDtrs: inactiveDTRs,
                    inactivePercentage: percent(inactiveDTRs, totalDTRs)
                },
                row2: {
                    daily: {
                        totalKwh: totalKwh.toFixed(2),
                        totalKvah: totalKvah.toFixed(2),
                        totalKw: totalKw.toFixed(2),
                        totalKva: totalKva.toFixed(2)
                    },
                    monthly: {
                        totalKwh: totalKwh.toFixed(2),
                        totalKvah: totalKvah.toFixed(2),
                        totalKw: totalKw.toFixed(2),
                        totalKva: totalKva.toFixed(2)
                    },
                    currentDay: {
                        totalKwh: currentDayKwh.toFixed(2),
                        totalKvah: currentDayKvah.toFixed(2),
                        totalKw: currentDayKw.toFixed(2),
                        totalKva: currentDayKva.toFixed(2)
                    }
                }
            };
        } catch (error) {
            console.error('Error fetching consolidated DTR stats:', error);
            throw error;
        }
    }



    static async getFeederStats(dtrId) {
        try {
            const dtr = await DTRDB.resolveDTRId(dtrId);
            const meters = await prisma.meters.findMany({
                where: { dtrId: dtr.id },
                select: { id: true }
            });
            const meterIds = meters.map(m => m.id);
            const totalLTFeeders = meterIds.length;

            const latestReadings = await Promise.all(
                meterIds.map(async meterId =>
                    await prisma.meter_readings.findFirst({
                        where: { meterId },
                        orderBy: { readingDate: 'desc' }
                    })
                )
            );
            const readingsArr = latestReadings.filter(Boolean);

            // Calculate consumption using (last reading - first reading) method for kWh and kVAh
            let totalKW = 0, totalKVA = 0, totalKWh = 0, totalKVAh = 0;
            
            if (meterIds.length > 0) {
                // Get all readings for consumption calculation
                const allReadings = await prisma.meter_readings.findMany({
                    where: {
                        meterId: { in: meterIds }
                    },
                    select: {
                        meterId: true,
                        readingDate: true,
                        kWh: true,
                        kVAh: true,
                        kW: true,
                        kVA: true
                    },
                    orderBy: [
                        { meterId: 'asc' },
                        { readingDate: 'asc' }
                    ]
                });

                // Group readings by meter for consumption calculation
                const meterReadings = {};
                allReadings.forEach(reading => {
                    if (!meterReadings[reading.meterId]) {
                        meterReadings[reading.meterId] = [];
                    }
                    meterReadings[reading.meterId].push(reading);
                });

                // Calculate consumption for each meter: last reading - first reading
                Object.values(meterReadings).forEach(meterDayReadings => {
                    if (meterDayReadings.length > 1) {
                        // Sort by reading time to get first and last
                        meterDayReadings.sort((a, b) => new Date(a.readingDate) - new Date(b.readingDate));
                        
                        const firstReading = meterDayReadings[0];
                        const lastReading = meterDayReadings[meterDayReadings.length - 1];
                        
                        // Calculate consumption: last - first for each metric
                        const meterKwh = (lastReading.kWh || 0) - (firstReading.kWh || 0);
                        const meterKvah = (lastReading.kVAh || 0) - (firstReading.kVAh || 0);
                        
                        // Only add positive consumption values
                        if (meterKwh >= 0) {
                            totalKWh += meterKwh;
                        }
                        if (meterKvah >= 0) {
                            totalKVAh += meterKvah;
                        }
                    }
                });

                // For kW and kVA: Use simple aggregation (sum of latest readings)
                for (const r of readingsArr) {
                    totalKW += r.kW || 0;
                    totalKVA += r.kVA || 0;
                }
            }

          
            const ltFuseBlown = readingsArr.filter(r =>
                (r.currentR === 0 || r.currentY === 0 || r.currentB === 0)
            ).length;

            const unbalancedLTFeeders = readingsArr.filter(r =>
                r.currentB !== null && r.currentB > 15
            ).length;

            // Use the already resolved DTR object
            let status = 'Normal';
            if (dtr) {
                if (dtr.loadPercentage > 90) status = 'Over Load';
                else if (dtr.loadPercentage < 30) status = 'Under Load';
            }

            const powerOnHours = null;
            const powerOffHours = null;

            // Get the latest communication date for this DTR's meters
            let lastCommunication = null;
            if (meterIds.length > 0) {
                const latestReading = await prisma.meter_readings.findFirst({
                    where: {
                        meterId: { in: meterIds }
                    },
                    orderBy: { readingDate: 'desc' },
                    select: { readingDate: true }
                });
                
                if (latestReading?.readingDate) {
                    // Convert to local time in IST timezone for consistent frontend display
                    const utcDate = new Date(latestReading.readingDate);
                    
                    // Get the time components (treating them as local time, not UTC)
                    const year = utcDate.getUTCFullYear();
                    const month = utcDate.getUTCMonth();
                    const day = utcDate.getUTCDate();
                    const hour = utcDate.getUTCHours();
                    const minute = utcDate.getUTCMinutes();
                    const second = utcDate.getUTCSeconds();
                    
                    // Create a new date object with these components in local timezone
                    const localDate = new Date(year, month, day, hour, minute, second);
                    
                    // Send ISO string that JavaScript can definitely parse
                    lastCommunication = localDate.toISOString();
                }
            }

            return {
                totalLTFeeders,
                totalKW,
                totalKVA,
                totalKWh,
                totalKVAh,
                ltFuseBlown,
                unbalancedLTFeeders,
                status,
                powerOnHours,
                powerOffHours,
                lastCommunication
            };
        } catch (error) {
            console.error('Error fetching feeder stats:', error);
            throw error;
        }
    }

    static async getInstantaneousStats(dtrId) {
        try {
            const dtr = await DTRDB.resolveDTRId(dtrId);
            // Get all meters associated with this DTR
            const meters = await prisma.meters.findMany({
                where: { dtrId: dtr.id },
                select: { id: true }
            });
            
            const meterIds = meters.map(m => m.id);
            
            if (meterIds.length === 0) {
                return {
                    rphVolt: 0, yphVolt: 0, bphVolt: 0,
                    instantKVA: 0, mdKVA: 0,
                    rphCurr: 0, yphCurr: 0, bphCurr: 0,
                    neutralCurrent: 0, freqHz: 0,
                    rphPF: 0, yphPF: 0, bphPF: 0,
                    avgPF: 0, cumulativeKVAh: 0,
                    lastCommDate: null,
                    meterCount: 0
                };
            }

            // Get latest readings for all meters in this DTR
            const latestReadings = await Promise.all(
                meterIds.map(async meterId => {
                                    return await prisma.meter_readings.findFirst({
                    where: { meterId },
                    orderBy: { readingDate: 'desc' }
                });
                })
            );

            const validReadings = latestReadings.filter(Boolean);
            
            if (validReadings.length === 0) {
                return {
                    rphVolt: 0, yphVolt: 0, bphVolt: 0,
                    instantKVA: 0, mdKVA: 0,
                    rphCurr: 0, yphCurr: 0, bphCurr: 0,
                    neutralCurrent: 0, freqHz: 0,
                    rphPF: 0, yphPF: 0, bphPF: 0,
                    avgPF: 0, cumulativeKVAh: 0,
                    lastCommDate: null,
                    meterCount: meterIds.length
                };
            }

            // Get all readings for all meters in this DTR for cumulative calculations
            const allReadings = await prisma.meter_readings.findMany({
                where: { meterId: { in: meterIds } }
            });

            // Calculate averages across all meters
            const avgRphVolt = validReadings.reduce((sum, r) => sum + (r.voltageR || 0), 0) / validReadings.length;
            const avgYphVolt = validReadings.reduce((sum, r) => sum + (r.voltageY || 0), 0) / validReadings.length;
            const avgBphVolt = validReadings.reduce((sum, r) => sum + (r.voltageB || 0), 0) / validReadings.length;
            const avgRphCurr = validReadings.reduce((sum, r) => sum + (r.currentR || 0), 0) / validReadings.length;
            const avgYphCurr = validReadings.reduce((sum, r) => sum + (r.currentY || 0), 0) / validReadings.length;
            const avgBphCurr = validReadings.reduce((sum, r) => sum + (r.currentB || 0), 0) / validReadings.length;
            const avgInstantKVA = validReadings.reduce((sum, r) => sum + (r.kVA !== null ? r.kVA : 0), 0) / validReadings.length;
            const avgFreqHz = validReadings.reduce((sum, r) => sum + (r.frequency || 0), 0) / validReadings.length;
            const avgPowerFactor = validReadings.reduce((sum, r) => sum + (r.averagePF || 0), 0) / validReadings.length;

            // Calculate maximum demand KVA across all meters (handle null values safely)
            const mdKVA = allReadings.length > 0 
                ? Math.max(...allReadings.map(r => r.kVA !== null ? r.kVA : 0))
                : 0;

            // Calculate cumulative KVAh across all meters (handle null values safely)
            const cumulativeKVAh = allReadings.reduce((sum, r) => sum + (r.kVAh !== null ? r.kVAh : 0), 0);

            // Calculate average phase-specific power factors
            const avgRphPF = validReadings.reduce((sum, r) => sum + (r.rphPowerFactor || r.averagePF || 0), 0) / validReadings.length;
            const avgYphPF = validReadings.reduce((sum, r) => sum + (r.yphPowerFactor || r.averagePF || 0), 0) / validReadings.length;
            const avgBphPF = validReadings.reduce((sum, r) => sum + (r.bphPowerFactor || r.averagePF || 0), 0) / validReadings.length;

            // Get the latest communication date
            const latestCommDate = validReadings.reduce((latest, r) => 
                r.readingDate > latest ? r.readingDate : latest, 
                validReadings[0].readingDate
            );

            // Convert the latest communication date to proper format (same as getDTRTable)
            let formattedLastCommDate = null;
            if (latestCommDate) {
                // Extract the time components from the UTC date and treat them as local time
                const utcDate = new Date(latestCommDate);
                
                // Get the time components (treating them as local time, not UTC)
                const year = utcDate.getUTCFullYear();
                const month = utcDate.getUTCMonth();
                const day = utcDate.getUTCDate();
                const hour = utcDate.getUTCHours();
                const minute = utcDate.getUTCMinutes();
                const second = utcDate.getUTCSeconds();
                
                // Create a new date object with these components in local timezone
                const localDate = new Date(year, month, day, hour, minute, second);
                
                // Send ISO string that JavaScript can definitely parse
                formattedLastCommDate = localDate.toISOString();
            }

            return {
                rphVolt: +(avgRphVolt).toFixed(2),
                yphVolt: +(avgYphVolt).toFixed(2),
                bphVolt: +(avgBphVolt).toFixed(2),
                instantKVA: +(avgInstantKVA).toFixed(2),
                mdKVA: +(mdKVA).toFixed(2),
                rphCurr: +(avgRphCurr).toFixed(2),
                yphCurr: +(avgYphCurr).toFixed(2),
                bphCurr: +(avgBphCurr).toFixed(2),
                neutralCurrent: +(avgBphCurr).toFixed(2), // Using B phase current as neutral
                freqHz: +(avgFreqHz).toFixed(2),
                rphPF: +(avgRphPF).toFixed(2),
                yphPF: +(avgYphPF).toFixed(2),
                bphPF: +(avgBphPF).toFixed(2),
                avgPF: +(avgPowerFactor).toFixed(2),
                cumulativeKVAh: +(cumulativeKVAh).toFixed(2),
                lastCommDate: formattedLastCommDate,
                meterCount: meterIds.length
            };
        } catch (error) {
            console.error('Error fetching instantaneous stats:', error);
            throw error;
        }
    }

    static async getDTRConsumptionAnalytics(dtrId, period) {
        try {
            const dtr = await DTRDB.resolveDTRId(dtrId);
            // Get all meters associated with this DTR
            const meters = await prisma.meters.findMany({
                where: { dtrId: dtr.id },
                select: { id: true }
            });
            
            const meterIds = meters.map(m => m.id);
            
            if (meterIds.length === 0) {
                return [];
            }

            if (period === 'daily') {
                const d1 = new Date();
                const sdf = (date) => getDateInYMDFormat(date);
                const presDate = sdf(new Date(d1.setDate(d1.getDate() - 62)));
                d1.setDate(d1.getDate() + 62);
                const nextDate = sdf(new Date(d1));

                let whereClause = {
                    meterId: { in: meterIds },
                    readingDate: {
                        gte: new Date(presDate),
                        lt: new Date(nextDate)
                    }
                };

                // Get all readings for the date range
                const allReadings = await prisma.meter_readings.findMany({
                    where: whereClause,
                    select: {
                        meterId: true,
                        readingDate: true,
                    kWh: true,
                    kVAh: true,
                    kW: true,
                    kVA: true
                },
                    orderBy: {
                        readingDate: 'asc'
                    }
                });

                // Group readings by date and calculate consumption as (last - first) for each day
                const dailyConsumption = {};
                
                allReadings.forEach(reading => {
                    const dateKey = getDateInYMDFormat(reading.readingDate);
                    
                    if (!dailyConsumption[dateKey]) {
                        dailyConsumption[dateKey] = {
                            consumption_date: dateKey,
                            count: 0,
                            total_kwh: 0,
                            total_kvah: 0,
                            total_kw: 0,
                            total_kva: 0,
                            readings: []
                        };
                    }
                    
                    dailyConsumption[dateKey].readings.push({
                        meterId: reading.meterId,
                        readingDate: reading.readingDate,
                        kWh: reading.kWh,
                        kVAh: reading.kVAh,
                        kW: reading.kW,
                        kVA: reading.kVA
                    });
                    dailyConsumption[dateKey].count++;
                });

                // Calculate consumption for each day: (last reading - first reading) for each meter
                const result = Object.values(dailyConsumption).map(dayData => {
                    let totalKwh = 0;
                    let totalKvah = 0;
                    let totalKw = 0;
                    let totalKva = 0;
                    
                    // Group readings by meter for this day
                    const meterReadings = {};
                    dayData.readings.forEach(reading => {
                        if (!meterReadings[reading.meterId]) {
                            meterReadings[reading.meterId] = [];
                        }
                        meterReadings[reading.meterId].push(reading);
                    });
                    
                    // Calculate consumption for each meter: last reading - first reading
                    Object.values(meterReadings).forEach(meterDayReadings => {
                        if (meterDayReadings.length > 1) {
                            // Sort by reading time to get first and last
                            meterDayReadings.sort((a, b) => new Date(a.readingDate) - new Date(b.readingDate));
                            
                            const firstReading = meterDayReadings[0];
                            const lastReading = meterDayReadings[meterDayReadings.length - 1];
                            
                            // Calculate consumption: last - first for each metric
                            const meterKwh = (lastReading.kWh || 0) - (firstReading.kWh || 0);
                            const meterKvah = (lastReading.kVAh || 0) - (firstReading.kVAh || 0);
                            const meterKw = (lastReading.kW || 0) - (firstReading.kW || 0);
                            const meterKva = (lastReading.kVA || 0) - (firstReading.kVA || 0);
                            
                            // Only add positive consumption values
                            if (meterKwh >= 0) totalKwh += meterKwh;
                            if (meterKvah >= 0) totalKvah += meterKvah;
                            if (meterKw >= 0) totalKw += meterKw;
                            if (meterKva >= 0) totalKva += meterKva;
                        }
                    });
                    
                    return {
                        consumption_date: dayData.consumption_date,
                        count: dayData.count,
                        total_kwh: totalKwh,
                        total_kvah: totalKvah,
                        total_kw: totalKw,
                        total_kva: totalKva
                    };
                });

                return result;
            }
            // monthly
            const d1 = new Date();
            const sdf = (date) => getDateInYMDFormat(date);
            const presDate = sdf(new Date(d1.setMonth(d1.getMonth() - 13)));
            d1.setMonth(d1.getMonth() + 14);
            const nextDate = sdf(new Date(d1));

            let whereClause = {
                meterId: { in: meterIds },
                readingDate: {
                    gte: new Date(presDate),
                    lt: new Date(nextDate)
                }
            };

            // Get all readings for the date range
            const allReadings = await prisma.meter_readings.findMany({
                where: whereClause,
                select: {
                    meterId: true,
                    readingDate: true,
                    kWh: true,
                    kVAh: true,
                    kW: true,
                    kVA: true
                },
                orderBy: {
                    readingDate: 'asc'
                }
            });

            // Group readings by month and calculate consumption as (last - first) for each month
            const monthlyConsumption = {};
            
            allReadings.forEach(reading => {
                const monthKey = getDateInYMDFormat(reading.readingDate).slice(0, 7); // YYYY-MM format
                
                if (!monthlyConsumption[monthKey]) {
                    monthlyConsumption[monthKey] = {
                        consumption_date: monthKey,
                        count: 0,
                        total_kwh: 0,
                        total_kvah: 0,
                        total_kw: 0,
                        total_kva: 0,
                        readings: []
                    };
                }
                
                monthlyConsumption[monthKey].readings.push({
                    meterId: reading.meterId,
                    readingDate: reading.readingDate,
                    kWh: reading.kWh,
                    kVAh: reading.kVAh,
                    kW: reading.kW,
                    kVA: reading.kVA
                });
                monthlyConsumption[monthKey].count++;
            });

            // Calculate consumption for each month: (last reading - first reading) for each meter
            const result = Object.values(monthlyConsumption).map(monthData => {
                let totalKwh = 0;
                let totalKvah = 0;
                let totalKw = 0;
                let totalKva = 0;
                
                // Group readings by meter for this month
                const meterReadings = {};
                monthData.readings.forEach(reading => {
                    if (!meterReadings[reading.meterId]) {
                        meterReadings[reading.meterId] = [];
                    }
                    meterReadings[reading.meterId].push(reading);
                });
                
                // Calculate consumption for each meter: last reading - first reading
                Object.values(meterReadings).forEach(meterMonthReadings => {
                    if (meterMonthReadings.length > 1) {
                        // Sort by reading time to get first and last
                        meterMonthReadings.sort((a, b) => new Date(a.readingDate) - new Date(b.readingDate));
                        
                        const firstReading = meterMonthReadings[0];
                        const lastReading = meterMonthReadings[meterMonthReadings.length - 1];
                        
                        // Calculate consumption: last - first for each metric
                        const meterKwh = (lastReading.kWh || 0) - (firstReading.kWh || 0);
                        const meterKvah = (lastReading.kVAh || 0) - (firstReading.kVAh || 0);
                        const meterKw = (lastReading.kW || 0) - (firstReading.kW || 0);
                        const meterKva = (lastReading.kVA || 0) - (firstReading.kVA || 0);
                        
                        // Only add positive consumption values
                        if (meterKwh >= 0) totalKwh += meterKwh;
                        if (meterKvah >= 0) totalKvah += meterKvah;
                        if (meterKw >= 0) totalKw += meterKw;
                        if (meterKva >= 0) totalKva += meterKva;
                    }
                });
                
                return {
                    consumption_date: monthData.consumption_date,
                    count: monthData.count,
                    total_kwh: totalKwh,
                    total_kvah: totalKvah,
                    total_kw: totalKw,
                    total_kva: totalKva
                };
            });

            return result.sort((a, b) => a.consumption_date.localeCompare(b.consumption_date));
        } catch (error) {
            console.error('Error fetching DTR consumption analytics:', error);
            throw error;
        }
    }

    static async getDTRConsumptionStats(dtrId) {
        try {
            const dtr = await DTRDB.resolveDTRId(dtrId);
            // Get all meters associated with this DTR
            const meters = await prisma.meters.findMany({
                where: { dtrId: dtr.id },
                select: { id: true }
            });
            
            const meterIds = meters.map(m => m.id);
            
            if (meterIds.length === 0) {
                return {
                    totalKWh: 0,
                    totalKVAh: 0,
                    totalKW: 0,
                    totalKVA: 0,
                    meterCount: 0
                };
            }

            const agg = await prisma.meter_readings.aggregate({
                where: {
                    meterId: { in: meterIds }
                },
                _sum: {
                    kWh: true,
                    kVAh: true,
                    kW: true,
                    kVA: true
                }
            });

            return {
                totalKWh: agg._sum.kWh || 0,
                totalKVAh: agg._sum.kVAh || 0,
                totalKW: agg._sum.kW || 0,
                totalKVA: agg._sum.kVA || 0,
                meterCount: meterIds.length
            };
        } catch (error) {
            console.error('Error fetching DTR consumption stats:', error);
            throw error;
        }
    }

    

    static async getDTRMainGraphAnalytics(dtrId, period) {
        try {
            const dtr = await DTRDB.resolveDTRId(dtrId);
            // Get all meters associated with this DTR
            const meters = await prisma.meters.findMany({
                where: { dtrId: dtr.id },
                select: { id: true }
            });
            
            const meterIds = meters.map(m => m.id);
            
            if (meterIds.length === 0) {
                return [];
            }

            if (period === 'daily') {
                const d1 = new Date();
                const sdf = (date) => getDateInYMDFormat(date);
                const presDate = sdf(new Date(d1.setDate(d1.getDate() - 62)));
                d1.setDate(d1.getDate() + 62);
                const nextDate = sdf(new Date(d1));

                let whereClause = {
                    meterId: { in: meterIds },
                    readingDate: {
                        gte: new Date(presDate),
                        lt: new Date(nextDate)
                    }
                };

                // Get all readings for the date range
                const allReadings = await prisma.meter_readings.findMany({
                    where: whereClause,
                    select: {
                        meterId: true,
                        readingDate: true,
                        kWh: true
                    },
                    orderBy: {
                        readingDate: 'asc'
                    }
                });

                // Group readings by date and calculate consumption as (last - first) for each day
                const dailyConsumption = {};
                
                allReadings.forEach(reading => {
                    const dateKey = getDateInYMDFormat(reading.readingDate);
                    
                    if (!dailyConsumption[dateKey]) {
                        dailyConsumption[dateKey] = {
                            consumption_date: dateKey,
                            count: 0,
                            total_consumption: 0,
                            readings: []
                        };
                    }
                    
                    dailyConsumption[dateKey].readings.push({
                        meterId: reading.meterId,
                        readingDate: reading.readingDate,
                        kWh: reading.kWh
                    });
                    dailyConsumption[dateKey].count++;
                });

                // Calculate consumption for each day: (last reading - first reading) for each meter
                const result = Object.values(dailyConsumption).map(dayData => {
                    let totalConsumption = 0;
                    
                    // Group readings by meter for this day
                    const meterReadings = {};
                    dayData.readings.forEach(reading => {
                        if (!meterReadings[reading.meterId]) {
                            meterReadings[reading.meterId] = [];
                        }
                        meterReadings[reading.meterId].push(reading);
                    });
                    
                    // Calculate consumption for each meter: last reading - first reading
                    Object.values(meterReadings).forEach(meterDayReadings => {
                        if (meterDayReadings.length > 1) {
                            // Sort by reading time to get first and last
                            meterDayReadings.sort((a, b) => new Date(a.readingDate) - new Date(b.readingDate));
                            
                            const firstReading = meterDayReadings[0];
                            const lastReading = meterDayReadings[meterDayReadings.length - 1];
                            
                            // Calculate consumption: last - first
                            const meterConsumption = (lastReading.kWh || 0) - (firstReading.kWh || 0);
                            if (meterConsumption >= 0) { // Only add positive consumption
                                totalConsumption += meterConsumption;
                            }
                        }
                    });
                    
                    return {
                        consumption_date: dayData.consumption_date,
                        count: dayData.count,
                        total_consumption: totalConsumption
                    };
                });

                return result;
            }
            // monthly
            const d1 = new Date();
            const sdf = (date) => getDateInYMDFormat(date);
            const presDate = sdf(new Date(d1.setMonth(d1.getMonth() - 13)));
            d1.setMonth(d1.getMonth() + 14);
            const nextDate = sdf(new Date(d1));

            let whereClause = {
                meterId: { in: meterIds },
                readingDate: {
                    gte: new Date(presDate),
                    lt: new Date(nextDate)
                }
            };

            // Get all readings for the date range
            const allReadings = await prisma.meter_readings.findMany({
                where: whereClause,
                select: {
                    meterId: true,
                    readingDate: true,
                    kWh: true
                },
                orderBy: {
                    readingDate: 'asc'
                }
            });

            // Group readings by month and calculate consumption as (last - first) for each month
            const monthlyConsumption = {};
            
            allReadings.forEach(reading => {
                const monthKey = getDateInYMDFormat(reading.readingDate).slice(0, 7); // YYYY-MM format
                
                if (!monthlyConsumption[monthKey]) {
                    monthlyConsumption[monthKey] = {
                        consumption_date: monthKey,
                        count: 0,
                        total_consumption: 0,
                        readings: []
                    };
                }
                
                monthlyConsumption[monthKey].readings.push({
                    meterId: reading.meterId,
                    readingDate: reading.readingDate,
                    kWh: reading.kWh
                });
                monthlyConsumption[monthKey].count++;
            });

            // Calculate consumption for each month: (last reading - first reading) for each meter
            const result = Object.values(monthlyConsumption).map(monthData => {
                let totalConsumption = 0;
                
                // Group readings by meter for this month
                const meterReadings = {};
                monthData.readings.forEach(reading => {
                    if (!meterReadings[reading.meterId]) {
                        meterReadings[reading.meterId] = [];
                    }
                    meterReadings[reading.meterId].push(reading);
                });
                
                // Calculate consumption for each meter: last reading - first reading
                Object.values(meterReadings).forEach(meterMonthReadings => {
                    if (meterMonthReadings.length > 1) {
                        // Sort by reading time to get first and last
                        meterMonthReadings.sort((a, b) => new Date(a.readingDate) - new Date(b.readingDate));
                        
                        const firstReading = meterMonthReadings[0];
                        const lastReading = meterMonthReadings[meterMonthReadings.length - 1];
                        
                        // Calculate consumption: last - first
                        const meterConsumption = (lastReading.kWh || 0) - (firstReading.kWh || 0);
                        if (meterConsumption >= 0) { // Only add positive consumption
                            totalConsumption += meterConsumption;
                        }
                    }
                });
                
                return {
                    consumption_date: monthData.consumption_date,
                    count: monthData.count,
                    total_consumption: totalConsumption
                };
            });

            return result.sort((a, b) => a.consumption_date.localeCompare(b.consumption_date));
        } catch (error) {
            console.error('Error fetching DTR main graph analytics:', error);
            throw error;
        }
    }

    static async getIndividualDTRAlerts(dtrId) {
        try {
            const dtr = await DTRDB.resolveDTRId(dtrId);
            
            // Get all meters associated with this DTR
            const meters = await prisma.meters.findMany({
                where: { dtrId: dtr.id },
                select: { id: true, meterNumber: true, serialNumber: true }
            });
            
            if (meters.length === 0) {
                return [];
            }
            
            const meterIds = meters.map(m => m.id);
            
            const alerts = await prisma.escalation_notifications.findMany({
                where: {
                    meterid: { in: meterIds }
                },
                include: {
                    meters: {
                        include: {
                            dtrs: {
                                include: {
                                    locations: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdat: 'desc' }
            });
            
            const mappedAlerts = alerts.map(alert => ({
                id: alert.id,
                meterId: alert.meterid,
                type: alert.type,
                level: alert.level,
                message: alert.message,
                status: alert.status,
                createdAt: alert.createdat,
                scheduledFor: alert.scheduledfor,
                sentAt: alert.sentat,
                resolvedAt: alert.resolvedat,
                dtrNumber: alert.dtrnumber,
                meterNumber: alert.meternumber,
                abnormalityType: alert.abnormalitytype,
                isResolved: alert.resolvedat !== null,
                isSent: alert.sentat !== null,
                escalationAge: alert.resolvedat ? 
                    Math.floor((new Date(alert.resolvedat) - new Date(alert.createdat)) / (1000 * 60 * 60 * 24)) : 
                    Math.floor((new Date() - new Date(alert.createdat)) / (1000 * 60 * 60 * 24)),
                meters: alert.meters
            }));
            
            return mappedAlerts;
        } catch (error) {
            console.error('Error fetching individual DTR alerts:', error);
            throw error;
        }
    }

    static async getKVAMetrics(dtrId, period) {
        try {
            const dtr = await DTRDB.resolveDTRId(dtrId);
            // Get all meters associated with this DTR
            const meters = await prisma.meters.findMany({
                where: { dtrId: dtr.id },
                select: { id: true }
            });
            
            const meterIds = meters.map(m => m.id);
            
            if (meterIds.length === 0) {
                return [];
            }

            if (period === 'daily') {
                const d1 = new Date();
                const sdf = (date) => getDateInYMDFormat(date);
                const presDate = sdf(new Date(d1.setDate(d1.getDate() - 62)));
                d1.setDate(d1.getDate() + 62);
                const nextDate = sdf(new Date(d1));

                let whereClause = {
                    meterId: { in: meterIds },
                    readingDate: {
                        gte: new Date(presDate),
                        lt: new Date(nextDate)
                    }
                };

                const result = await prisma.meter_readings.groupBy({
                    by: ['readingDate'],
                    where: whereClause,
                    _count: {
                        id: true
                    },
                    _sum: {
                        kVA: true
                    },
                    orderBy: {
                        readingDate: 'asc'
                    }
                });

                return result.map(item => ({
                    kva_date: getDateInYMDFormat(item.readingDate),
                    count: item._count.id,
                    total_kva: item._sum.kVA || 0
                }));

            }
            // monthly
            const d1 = new Date();
            const sdf = (date) => getDateInYMDFormat(date);
            const presDate = sdf(new Date(d1.setMonth(d1.getMonth() - 13)));
            d1.setMonth(d1.getMonth() + 14);
            const nextDate = sdf(new Date(d1));

            let whereClause = {
                meterId: { in: meterIds },
                readingDate: {
                    gte: new Date(presDate),
                    lt: new Date(nextDate)
                }
            };

                // Get all readings for the date range
                const allReadings = await prisma.meter_readings.findMany({
                where: whereClause,
                    select: {
                        meterId: true,
                        readingDate: true,
                    kVA: true
                },
                orderBy: {
                    readingDate: 'asc'
                }
            });

                // Group readings by month and sum KVA values for each month
            const monthlyData = {};
                
                allReadings.forEach(reading => {
                    const monthKey = getDateInYMDFormat(reading.readingDate).slice(0, 7); // YYYY-MM format
                    
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = {
                        kva_date: monthKey,
                        count: 0,
                        total_kva: 0
                    };
                }
                    
                    monthlyData[monthKey].count += 1;
                    monthlyData[monthKey].total_kva += reading.kVA || 0;
            });

            return Object.values(monthlyData).sort((a, b) => a.kva_date.localeCompare(b.kva_date));
        } catch (error) {
            console.error('Error fetching DTR kVA metrics:', error);
            throw error;
        }
    }

    // Helper method to build complete location hierarchy
    static async buildLocationHierarchy(locationId) {
        try {
            const hierarchy = [];
            let currentLocationId = locationId;
            
            while (currentLocationId) {
                const location = await prisma.locations.findUnique({
                    where: { id: currentLocationId },
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        locationTypeId: true,
                        parentId: true,
                        location_types: {
                            select: {
                                name: true,
                                level: true
                            }
                        }
                    }
                });
                
                if (!location) break;
                
                // Normalize type names to match frontend expectations
                let normalizedType = location.location_types.name;
                
                // Map backend type names to frontend expected names
                if (normalizedType === 'Sub division') {
                    normalizedType = 'Sub-Division';
                } else if (normalizedType === 'DTR Location') {
                    normalizedType = 'Feeder';
                }
                
                hierarchy.unshift({
                    id: location.id,
                    name: location.name,
                    code: location.code,
                    type: normalizedType,
                    level: location.location_types.level
                });
                
                currentLocationId = location.parentId;
            }
            
            return hierarchy;
        } catch (error) {
            console.error('Error building location hierarchy:', error);
            return [];
        }
    }

    static async getAllMetersData({ page = 1, pageSize = 20, search = '', locationId } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {};

            // Add search functionality
            if (search) {
                where.OR = [
                    { meterNumber: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { dtrs: { dtrNumber: { contains: search, mode: 'insensitive' } } },
                    { dtrs: { serialNumber: { contains: search, mode: 'insensitive' } } },
                    { locations: { name: { contains: search, mode: 'insensitive' } } }
                ];
            }

            // Filter by location if provided
            if (locationId) {
                where.locationId = locationId;
            }

            // Get total count
            const total = await prisma.meters.count({ where });

            // Get meters with related data
            const meters = await prisma.meters.findMany({
                where,
                include: {
                    dtrs: {
                        select: {
                            id: true,
                            dtrNumber: true,
                            serialNumber: true
                        }
                    },
                    locations: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    meter_readings: {
                        orderBy: { readingDate: 'desc' },
                        take: 1,
                        select: {
                            readingDate: true
                        }
                    }
                },
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' }
            });

            // Process the data to add communication status and format dates
            const processedMeters = meters.map((meter, index) => {
                const globalIndex = skip + index + 1;
                const lastReading = meter.meter_readings?.[0];
                let lastCommunication = null;
                let communicationStatus = 'Inactive';

                if (lastReading?.readingDate) {
                    // Convert to IST timezone for consistent display
                    const utcDate = new Date(lastReading.readingDate);
                    const year = utcDate.getUTCFullYear();
                    const month = utcDate.getUTCMonth();
                    const day = utcDate.getUTCDate();
                    const hour = utcDate.getUTCHours();
                    const minute = utcDate.getUTCMinutes();
                    const second = utcDate.getUTCSeconds();
                    
                    const localDate = new Date(year, month, day, hour, minute, second);
                    lastCommunication = localDate.toISOString();

                    // Determine communication status (active if reading is within last 24 hours)
                    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    communicationStatus = localDate > oneDayAgo ? 'Active' : 'Inactive';
                }

                return {
                    slNo: globalIndex,
                    dtrId: meter.dtrs?.dtrNumber || 'N/A',
                    meterNo: meter.meterNumber || 'N/A',
                    dtrName: meter.dtrs?.serialNumber || 'N/A',
                    location: meter.locations?.name || 'N/A',
                    communicationStatus,
                    lastCommunicationDate: lastCommunication ? new Date(lastCommunication).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    }) : 'N/A'
                };
            });

            return {
                data: processedMeters,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            console.error('Error fetching all meters data:', error);
            throw error;
        }
    }

    static async getFuseBlownMeters({ page = 1, pageSize = 20, search = '', locationId } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {};

            // Filter by location if provided
            if (locationId) {
                where.locationId = locationId;
            }

            // Get all meters with their latest readings
            const meters = await prisma.meters.findMany({
                where,
                include: {
                    dtrs: {
                        select: {
                            id: true,
                            dtrNumber: true,
                            serialNumber: true
                        }
                    },
                    locations: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    meter_readings: {
                        orderBy: { readingDate: 'desc' },
                        take: 1,
                        select: {
                            currentR: true,
                            currentY: true,
                            currentB: true,
                            voltageR: true,
                            voltageY: true,
                            voltageB: true,
                            readingDate: true
                        }
                    }
                }
            });

            // Filter meters that have fuse blown conditions
            const fuseBlownMeters = meters.filter(meter => {
                const latestReading = meter.meter_readings?.[0];
                if (!latestReading) return false;

                // Check LT Fuse Blown (any phase current is 0)
                const ltFuseBlown = (latestReading.currentR === 0 || latestReading.currentY === 0 || latestReading.currentB === 0);
                
                // Check HT Fuse Blown (any phase voltage < 180V)
                const htFuseBlown = (latestReading.voltageR !== null && latestReading.voltageR < 180) ||
                                   (latestReading.voltageY !== null && latestReading.voltageY < 180) ||
                                   (latestReading.voltageB !== null && latestReading.voltageB < 180);

                return ltFuseBlown || htFuseBlown;
            });

            // Apply search filter if provided
            let filteredMeters = fuseBlownMeters;
            if (search) {
                filteredMeters = fuseBlownMeters.filter(meter => 
                    meter.meterNumber?.toLowerCase().includes(search.toLowerCase()) ||
                    meter.dtrs?.dtrNumber?.toLowerCase().includes(search.toLowerCase()) ||
                    meter.dtrs?.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
                    meter.locations?.name?.toLowerCase().includes(search.toLowerCase())
                );
            }

            const total = filteredMeters.length;
            const paginatedMeters = filteredMeters.slice(skip, skip + pageSize);

            // Process the data for frontend
            const processedMeters = paginatedMeters.map((meter, index) => {
                const globalIndex = skip + index + 1;
                const latestReading = meter.meter_readings?.[0];
                
                // Determine fuse type
                let fuseType = 'Unknown';
                if (latestReading) {
                    const ltFuseBlown = (latestReading.currentR === 0 || latestReading.currentY === 0 || latestReading.currentB === 0);
                    const htFuseBlown = (latestReading.voltageR !== null && latestReading.voltageR < 180) ||
                                       (latestReading.voltageY !== null && latestReading.voltageY < 180) ||
                                       (latestReading.voltageB !== null && latestReading.voltageB < 180);
                    
                    if (ltFuseBlown && htFuseBlown) {
                        fuseType = 'Both LT & HT';
                    } else if (ltFuseBlown) {
                        fuseType = 'LT Fuse';
                    } else if (htFuseBlown) {
                        fuseType = 'HT Fuse';
                    }
                }

                // Calculate blown time (time since last reading)
                let blownTime = 'Unknown';
                if (latestReading?.readingDate) {
                    const readingDate = new Date(latestReading.readingDate);
                    const now = new Date();
                    const diffMs = now - readingDate;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffHours / 24);
                    
                    if (diffDays > 0) {
                        blownTime = `${diffDays} day(s) ago`;
                    } else if (diffHours > 0) {
                        blownTime = `${diffHours} hour(s) ago`;
                    } else {
                        blownTime = 'Less than 1 hour ago';
                    }
                }

                return {
                    slNo: globalIndex,
                    meterNo: meter.meterNumber || 'N/A',
                    dtrId: meter.dtrs?.dtrNumber || 'N/A',
                    dtrName: meter.dtrs?.serialNumber || 'N/A',
                    location: meter.locations?.name || 'N/A',
                    fuseType,
                    blownTime,
                    lastReadingDate: latestReading?.readingDate ? new Date(latestReading.readingDate).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    }) : 'N/A',
                    // Add current readings for reference
                    currentR: latestReading?.currentR || 'N/A',
                    currentY: latestReading?.currentY || 'N/A',
                    currentB: latestReading?.currentB || 'N/A',
                    voltageR: latestReading?.voltageR || 'N/A',
                    voltageY: latestReading?.voltageY || 'N/A',
                    voltageB: latestReading?.voltageB || 'N/A'
                };
            });

            return {
                data: processedMeters,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            console.error('Error fetching fuse blown meters:', error);
            throw error;
        }
    }

    static async getOverloadedDTRs({ page = 1, pageSize = 20, search = '', locationId } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {
                loadPercentage: { gt: 90 }
            };

            // Filter by location if provided
            if (locationId) {
                where.locationId = locationId;
            }

            // Add search filters to the database query
            if (search) {
                where.OR = [
                    { dtrNumber: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { manufacturer: { contains: search, mode: 'insensitive' } },
                    { model: { contains: search, mode: 'insensitive' } },
                    { locations: { name: { contains: search, mode: 'insensitive' } } }
                ];
            }

            // Get total count with search filters applied
            const total = await prisma.dtrs.count({ where });

            // Get overloaded DTRs with related data
            const overloadedDTRs = await prisma.dtrs.findMany({
                where,
                include: {
                    locations: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    meters: {
                        select: {
                            id: true
                        }
                    }
                },
                skip,
                take: pageSize,
                orderBy: { loadPercentage: 'desc' }
            });

            // Process the data for frontend
            const processedDTRs = overloadedDTRs.map((dtr, index) => {
                const globalIndex = skip + index + 1;
                
                return {
                    slNo: globalIndex,
                    dtrId: dtr.dtrNumber || 'N/A',
                    dtrName: dtr.serialNumber || 'N/A',
                    manufacturer: dtr.manufacturer || 'N/A',
                    model: dtr.model || 'N/A',
                    capacity: dtr.capacity || 'N/A',
                    loadPercentage: dtr.loadPercentage || 0,
                    location: dtr.locations?.name || 'N/A',
                    feedersCount: dtr.meters?.length || 0,
                    status: dtr.status || 'N/A'
                };
            });

            return {
                data: processedDTRs,
                total: total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            console.error('Error fetching overloaded DTRs:', error);
            throw error;
        }
    }

    static async getUnderloadedDTRs({ page = 1, pageSize = 20, search = '', locationId } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {
                loadPercentage: { lt: 30 }
            };

            // Filter by location if provided
            if (locationId) {
                where.locationId = locationId;
            }

            // Add search filters to the database query
            if (search) {
                where.OR = [
                    { dtrNumber: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { manufacturer: { contains: search, mode: 'insensitive' } },
                    { model: { contains: search, mode: 'insensitive' } },
                    { locations: { name: { contains: search, mode: 'insensitive' } } }
                ];
            }

            // Get total count with search filters applied
            const total = await prisma.dtrs.count({ where });

            // Get underloaded DTRs with related data
            const underloadedDTRs = await prisma.dtrs.findMany({
                where,
                include: {
                    locations: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    meters: {
                        select: {
                            id: true
                        }
                    }
                },
                skip,
                take: pageSize,
                orderBy: { loadPercentage: 'asc' }
            });

            // Process the data for frontend
            const processedDTRs = underloadedDTRs.map((dtr, index) => {
                const globalIndex = skip + index + 1;
                
                return {
                    slNo: globalIndex,
                    dtrId: dtr.dtrNumber || 'N/A',
                    dtrName: dtr.serialNumber || 'N/A',
                    manufacturer: dtr.manufacturer || 'N/A',
                    model: dtr.model || 'N/A',
                    capacity: dtr.capacity || 'N/A',
                    loadPercentage: dtr.loadPercentage || 0,
                    location: dtr.locations?.name || 'N/A',
                    feedersCount: dtr.meters?.length || 0,
                    status: dtr.status || 'N/A'
                };
            });

            return {
                data: processedDTRs,
                total: total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            console.error('Error fetching underloaded DTRs:', error);
            throw error;
        }
    }

    static async searchDTRs(searchQuery) {
        try {
            // Search in DTRs by number, name, and related information
            const results = await prisma.dtrs.findMany({
                where: {
                    OR: [
                        // Search by DTR number
                        {
                            dtrNumber: {
                                contains: searchQuery,
                                mode: 'insensitive'
                            }
                        },
                        // Search by DTR serial number
                        {
                            serialNumber: {
                                contains: searchQuery,
                                mode: 'insensitive'
                            }
                        },
                        // Search by location name
                        {
                            locations: {
                                name: {
                                    contains: searchQuery,
                                    mode: 'insensitive'
                                }
                            }
                        },
                        // Search by associated meters
                        {
                            meters: {
                                some: {
                                    OR: [
                                        {
                                            meterNumber: {
                                                contains: searchQuery,
                                                mode: 'insensitive'
                                            }
                                        },
                                        {
                                            serialNumber: {
                                                contains: searchQuery,
                                                mode: 'insensitive'
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                },
                include: {
                    locations: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    meters: {
                        select: {
                            id: true,
                            meterNumber: true,
                            serialNumber: true,
                            type: true
                        },
                        take: 1 // Just get one meter for display
                    }
                },
                take: 10 // Limit results for performance
            });

            // Transform results for consistent response format
            const transformedResults = results.map(dtr => ({
                id: dtr.id,
                dtrNumber: dtr.dtrNumber,
                serialNumber: dtr.serialNumber,
                location: dtr.locations?.name || 'Unknown Location',
                locationId: dtr.locations?.id,
                meter: dtr.meters?.[0] ? {
                    meterNumber: dtr.meters[0].meterNumber,
                    serialNumber: dtr.meters[0].serialNumber,
                    type: dtr.meters[0].type
                } : null,
                type: 'dtr'
            }));

            return transformedResults;
            
        } catch (error) {
            console.error('Error searching DTRs:', error);
            throw error;
        }
    }

    static async getLTSideFuseBlownData({ page = 1, pageSize = 20, search = '', locationId } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {};
            
            if (locationId) {
                where.locationId = locationId;
            }

            // Get all DTRs with their meters
            const dtrs = await prisma.dtrs.findMany({
                where,
                include: {
                    locations: { select: { id: true, name: true, address: true } },
                    meters: { select: { id: true, meterNumber: true, serialNumber: true } }
                }
            });

            const ltFuseBlownData = [];

            for (const dtr of dtrs) {
                if (dtr.meters.length === 0) continue;

                const meterIds = dtr.meters.map(m => m.id);

                // Get latest reading for each meter
                const latestReading = await prisma.meter_readings.findFirst({
                    where: { meterId: { in: meterIds } },
                    orderBy: { readingDate: 'desc' },
                    include: { meters: { select: { id: true, meterNumber: true, serialNumber: true } } }
                });

                if (!latestReading) continue;

                // Check for LT fuse blown (any current phase = 0)
                const hasLTFuseBlown = (
                    (latestReading.currentR !== null && latestReading.currentR === 0) ||
                    (latestReading.currentY !== null && latestReading.currentY === 0) ||
                    (latestReading.currentB !== null && latestReading.currentB === 0)
                );

                if (hasLTFuseBlown) {
                    // Convert UTC to local time
                    const utcDate = new Date(latestReading.readingDate);
                    const localDate = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), utcDate.getUTCHours(), utcDate.getUTCMinutes(), utcDate.getUTCSeconds());

                    ltFuseBlownData.push({
                        dtrId: dtr.dtrNumber || dtr.id,
                        dtrName: dtr.serialNumber || `DTR-${dtr.id}`,
                        fuseType: 'LT Fuse',
                        blownTime: localDate.toLocaleString('en-IN', { 
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit', 
                            hour12: true 
                        }),
                        location: dtr.locations?.name || 'Unknown Location',
                        status: 'Fuse Blown'
                    });
                }
            }

            // Apply search filter
            let filteredData = ltFuseBlownData;
            if (search) {
                filteredData = ltFuseBlownData.filter(item =>
                    item.dtrId.toLowerCase().includes(search.toLowerCase()) ||
                    item.dtrName.toLowerCase().includes(search.toLowerCase()) ||
                    item.location.toLowerCase().includes(search.toLowerCase())
                );
            }

            const total = filteredData.length;
            const paginatedData = filteredData.slice(skip, skip + pageSize);
            
            // Add serial numbers
            const dataWithSerial = paginatedData.map((item, index) => ({
                sNo: skip + index + 1,
                ...item
            }));

            return {
                data: dataWithSerial,
                total,
                page,
                pageSize
            };

        } catch (error) {
            console.error('Error fetching LT Side Fuse Blown data:', error);
            throw error;
        }
    }

    static async getUnbalancedDTRsData({ page = 1, pageSize = 20, search = '', locationId } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {};
            
            if (locationId) {
                where.locationId = locationId;
            }

            // Get all DTRs with their meters
            const dtrs = await prisma.dtrs.findMany({
                where,
                include: {
                    locations: { select: { id: true, name: true, address: true } },
                    meters: { select: { id: true, meterNumber: true, serialNumber: true } }
                }
            });

            const unbalancedDTRsData = [];

            for (const dtr of dtrs) {
                if (dtr.meters.length === 0) continue;

                const meterIds = dtr.meters.map(m => m.id);

                // Get latest reading for each meter
                const latestReading = await prisma.meter_readings.findFirst({
                    where: { meterId: { in: meterIds } },
                    orderBy: { readingDate: 'desc' },
                    include: { meters: { select: { id: true, meterNumber: true, serialNumber: true } } }
                });

                if (!latestReading) continue;

                // Check for unbalanced load
                const currentR = latestReading.currentR || 0;
                const currentY = latestReading.currentY || 0;
                const currentB = latestReading.currentB || 0;

                // Calculate imbalance percentage
                const maxCurrent = Math.max(currentR, currentY, currentB);
                const minCurrent = Math.min(currentR, currentY, currentB);
                const averageCurrent = (currentR + currentY + currentB) / 3;
                
                // Consider imbalanced if there's > 20% difference from average or if any phase > 15A difference
                const isUnbalanced = (
                    averageCurrent > 0 && (
                        Math.abs(currentR - averageCurrent) / averageCurrent > 0.2 ||
                        Math.abs(currentY - averageCurrent) / averageCurrent > 0.2 ||
                        Math.abs(currentB - averageCurrent) / averageCurrent > 0.2 ||
                        (maxCurrent - minCurrent) > 15
                    )
                );

                if (isUnbalanced) {
                    // Calculate imbalance percentage
                    const imbalancePercentage = averageCurrent > 0 ? 
                        ((maxCurrent - minCurrent) / averageCurrent * 100).toFixed(2) : 0;

                    unbalancedDTRsData.push({
                        dtrId: dtr.dtrNumber || dtr.id,
                        dtrName: dtr.serialNumber || `DTR-${dtr.id}`,
                        phaseA: currentR.toFixed(2),
                        phaseB: currentY.toFixed(2),
                        phaseC: currentB.toFixed(2),
                        imbalance: `${imbalancePercentage}%`,
                        location: dtr.locations?.name || 'Unknown Location'
                    });
                }
            }

            // Apply search filter
            let filteredData = unbalancedDTRsData;
            if (search) {
                filteredData = unbalancedDTRsData.filter(item =>
                    item.dtrId.toLowerCase().includes(search.toLowerCase()) ||
                    item.dtrName.toLowerCase().includes(search.toLowerCase()) ||
                    item.location.toLowerCase().includes(search.toLowerCase())
                );
            }

            const total = filteredData.length;
            const paginatedData = filteredData.slice(skip, skip + pageSize);
            
            // Add serial numbers
            const dataWithSerial = paginatedData.map((item, index) => ({
                sNo: skip + index + 1,
                ...item
            }));

            return {
                data: dataWithSerial,
                total,
                page,
                pageSize
            };

        } catch (error) {
            console.error('Error fetching Unbalanced DTRs data:', error);
            throw error;
        }
    }

    static async getPowerFailureFeedersData({ page = 1, pageSize = 20, search = '', locationId } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {};
            
            if (locationId) {
                where.locationId = locationId;
            }

            // Get all DTRs with their meters
            const dtrs = await prisma.dtrs.findMany({
                where,
                include: {
                    locations: { select: { id: true, name: true, address: true } },
                    meters: { select: { id: true, meterNumber: true, serialNumber: true } }
                }
            });

            const powerFailureData = [];

            for (const dtr of dtrs) {
                if (dtr.meters.length === 0) continue;

                const meterIds = dtr.meters.map(m => m.id);

                // Get latest reading for each meter
                const latestReading = await prisma.meter_readings.findFirst({
                    where: { meterId: { in: meterIds } },
                    orderBy: { readingDate: 'desc' },
                    include: { meters: { select: { id: true, meterNumber: true, serialNumber: true } } }
                });

                if (!latestReading) continue;

                // Check for power failure (power factor = 0 or very low voltage indicating no power)
                const hasPowerFailure = (
                    (latestReading.powerFactor !== null && latestReading.powerFactor === 0) ||
                    (latestReading.voltageR !== null && latestReading.voltageR === 0) ||
                    (latestReading.voltageY !== null && latestReading.voltageY === 0) ||
                    (latestReading.voltageB !== null && latestReading.voltageB === 0)
                );

                if (hasPowerFailure) {
                    // Convert UTC to local time
                    const utcDate = new Date(latestReading.readingDate);
                    const localDate = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), utcDate.getUTCHours(), utcDate.getUTCMinutes(), utcDate.getUTCSeconds());

                    // Estimate affected consumers (dummy calculation - you can replace with actual logic)
                    const estimatedConsumers = Math.floor(Math.random() * 50) + 10;
                    
                    // Estimate restoration time (dummy calculation - you can replace with actual logic)
                    const hoursToRestore = Math.floor(Math.random() * 6) + 1;
                    const estimatedRestoration = new Date(localDate.getTime() + (hoursToRestore * 60 * 60 * 1000));

                    powerFailureData.push({
                        feederId: `FEEDER-${dtr.id}`,
                        feederName: `${dtr.serialNumber || `DTR-${dtr.id}`} Main Feeder`,
                        failureTime: localDate.toLocaleString('en-IN', { 
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit', 
                            hour12: true 
                        }),
                        affectedConsumers: estimatedConsumers,
                        estimatedRestoration: estimatedRestoration.toLocaleString('en-IN', { 
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: true 
                        }),
                        location: dtr.locations?.name || 'Unknown Location'
                    });
                }
            }

            // Apply search filter
            let filteredData = powerFailureData;
            if (search) {
                filteredData = powerFailureData.filter(item =>
                    item.feederId.toLowerCase().includes(search.toLowerCase()) ||
                    item.feederName.toLowerCase().includes(search.toLowerCase()) ||
                    item.location.toLowerCase().includes(search.toLowerCase())
                );
            }

            const total = filteredData.length;
            const paginatedData = filteredData.slice(skip, skip + pageSize);
            
            // Add serial numbers
            const dataWithSerial = paginatedData.map((item, index) => ({
                sNo: skip + index + 1,
                ...item
            }));

            return {
                data: dataWithSerial,
                total,
                page,
                pageSize
            };

        } catch (error) {
            console.error('Error fetching Power Failure Feeders data:', error);
            throw error;
        }
    }

    static async getHTSideFuseBlownData({ page = 1, pageSize = 20, search = '', locationId } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {};

            // Build location filter
            if (locationId) {
                where.locationId = locationId;
            }

            // Get all DTRs (filtered by location if specified)
            const dtrs = await prisma.dtrs.findMany({
                where,
                include: {
                    locations: {
                        select: {
                            id: true,
                            name: true,
                            address: true
                        }
                    },
                    meters: {
                        select: {
                            id: true,
                            meterNumber: true,
                            serialNumber: true
                        }
                    }
                }
            });

            // Get latest readings for all meters and filter for HT fuse blown conditions
            const htFuseBlownData = [];
            
            for (const dtr of dtrs) {
                if (dtr.meters.length === 0) continue;

                const meterIds = dtr.meters.map(m => m.id);
                
                // Get latest reading for this DTR's meters
                const latestReading = await prisma.meter_readings.findFirst({
                    where: {
                        meterId: { in: meterIds }
                    },
                    orderBy: { readingDate: 'desc' },
                    include: {
                        meters: {
                            select: {
                                id: true,
                                meterNumber: true,
                                serialNumber: true
                            }
                        }
                    }
                });

                if (!latestReading) continue;

                // Check for HT fuse blown condition (voltage readings below threshold)
                const htFuseBlown = (
                    (latestReading.voltageR !== null && latestReading.voltageR < 180) ||
                    (latestReading.voltageY !== null && latestReading.voltageY < 180) ||
                    (latestReading.voltageB !== null && latestReading.voltageB < 180)
                );

                if (htFuseBlown) {
                    // Determine which phase(s) have blown fuses
                    const blownPhases = [];
                    if (latestReading.voltageR !== null && latestReading.voltageR < 180) blownPhases.push('R');
                    if (latestReading.voltageY !== null && latestReading.voltageY < 180) blownPhases.push('Y');
                    if (latestReading.voltageB !== null && latestReading.voltageB < 180) blownPhases.push('B');

                    // Convert to local time for consistent display
                    const utcDate = new Date(latestReading.readingDate);
                    const year = utcDate.getUTCFullYear();
                    const month = utcDate.getUTCMonth();
                    const day = utcDate.getUTCDate();
                    const hour = utcDate.getUTCHours();
                    const minute = utcDate.getUTCMinutes();
                    const second = utcDate.getUTCSeconds();
                    const localDate = new Date(year, month, day, hour, minute, second);

                    htFuseBlownData.push({
                        dtrId: dtr.dtrNumber || dtr.id,
                        dtrName: dtr.serialNumber || `DTR-${dtr.id}`,
                        fuseType: 'HT Fuse',
                        blownTime: localDate.toLocaleString('en-IN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                        }),
                        location: dtr.locations?.name || 'Unknown Location',
                        status: 'Fuse Blown'
                    });
                }
            }

            // Apply search filter if provided
            let filteredData = htFuseBlownData;
            if (search) {
                filteredData = htFuseBlownData.filter(item =>
                    item.dtrId.toLowerCase().includes(search.toLowerCase()) ||
                    item.dtrName.toLowerCase().includes(search.toLowerCase()) ||
                    item.location.toLowerCase().includes(search.toLowerCase()) ||
                    item.meterNumber.toLowerCase().includes(search.toLowerCase())
                );
            }

            // Apply pagination
            const total = filteredData.length;
            const paginatedData = filteredData.slice(skip, skip + pageSize);

            // Add serial numbers
            const dataWithSerial = paginatedData.map((item, index) => ({
                sNo: skip + index + 1,
                ...item
            }));

            return {
                data: dataWithSerial,
                total,
                page,
                pageSize
            };
        } catch (error) {
            console.error('Error fetching HT Side Fuse Blown data:', error);
            throw error;
        }
    }
}

export default DTRDB; 