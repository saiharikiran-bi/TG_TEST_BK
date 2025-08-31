import DTRDB from '../models/DTRDB.js';
import { getDateTime, getDateInYMDFormat, getDateInMYFormat, fillMissingDatesDyno } from '../utils/utils.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDTRFilterOptions = async (req, res) => {
    try {
        // Get filter options for DTRs (locations, statuses, etc.)
        const locations = await prisma.locations.findMany({
            select: { id: true, name: true, code: true }
        });
        
        const dtrStatuses = ['Active', 'Inactive', 'Maintenance', 'Fault'];
        const dtrCapacities = ['100 KVA', '200 KVA', '315 KVA', '400 KVA', '500 KVA', '630 KVA', '1000 KVA'];
        
        res.json({
            success: true,
            data: {
                locations,
                statuses: dtrStatuses,
                capacities: dtrCapacities
            },
            message: 'DTR filter options fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching DTR filter options:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DTR filter options',
            error: error.message
        });
    }
};
import LocationDB from '../models/LocationDB.js';

export const getDTRTable = async (req, res) => {
    try {
        const { page, pageSize, search, status, locationId } = req.query;
        
        // Get user's location from req.user (populated by middleware)
        const userLocationId = req.user?.locationId;
        
        // If user has a specific location, use it; otherwise use query locationId or undefined
        const effectiveLocationId = userLocationId || (locationId ? parseInt(locationId) : undefined);
        
        const result = await DTRDB.getDTRTable({
            page: page ? parseInt(page) : 1,
            pageSize: pageSize ? parseInt(pageSize) : 10,
            search: search || '',
            status: status || undefined,
            locationId: effectiveLocationId
        });

        // Map the data to match frontend table columns exactly
        const mappedData = result.data.map((dtr, idx) => ({
            sNo: (result.page - 1) * result.pageSize + idx + 1,
            dtrId: dtr.dtrNumber || 'NA',
            dtrName: dtr.serialNumber || 'NA',
            feedersCount: dtr.feedersCount || 0,
            streetName: dtr.locations?.address || 'NA',
            city: dtr.locations?.name || 'NA',
            commStatus: dtr.status || 'NA',
            lastCommunication: dtr.lastCommunication ? new Date(dtr.lastCommunication).toLocaleString() : 'NA'
        }));

        res.json({
            success: true,
            data: mappedData,
            pagination: {
                currentPage: result.page,
                totalPages: Math.ceil(result.total / result.pageSize),
                totalCount: result.total,
                limit: result.pageSize,
                hasNextPage: result.page < Math.ceil(result.total / result.pageSize),
                hasPrevPage: result.page > 1
            },
            message: 'DTR table fetched successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error fetching DTR table:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DTR table',
            error: error.message
        });
    }
};

export const getFeedersForDTR = async (req, res) => {
    try {
        const { dtrId } = req.params;
        
        // Prevent invalid DTR IDs from being processed
        if (!dtrId || dtrId === 'stats' || dtrId === 'alerts') {
            return res.status(400).json({
                success: false,
                message: 'Invalid DTR ID provided',
                error: `DTR ID "${dtrId}" is not valid. Expected a numeric ID or DTR number.`
            });
        }
        
        const feedersData = await DTRDB.getFeedersForDTR(dtrId);

        
        // Map feeders data to match frontend expectations
        const mappedFeeders = feedersData.feeders.map((feeder, idx) => ({
            sNo: idx + 1,
            feederId: feeder.id,
            meterNumber: feeder.meterNumber || 'NA',
            serialNumber: feeder.serialNumber || 'NA',
            manufacturer: feeder.manufacturer || 'NA',
            model: feeder.model || 'NA',
            type: feeder.type || 'NA',
            phase: feeder.phase || 'NA',
            status: feeder.status || 'NA',
            location: feeder.location ? feeder.location.name : 'NA',
            city: feeder.location ? feeder.location.city : 'NA',
            latitude: feeder.location ? feeder.location.latitude : null,
            longitude: feeder.location ? feeder.location.longitude : null
        }));

        const mappedDTR = {
            dtrId: feedersData.dtr.id,
            dtrNumber: feedersData.dtr.dtrNumber || 'NA',
            serialNumber: feedersData.dtr.serialNumber || 'NA',
            manufacturer: feedersData.dtr.manufacturer || 'NA',
            model: feedersData.dtr.model || 'NA',
            capacity: feedersData.dtr.capacity || 0,
            loadPercentage: feedersData.dtr.loadPercentage || 0,
            status: feedersData.dtr.status || 'NA',
            lastCommunication: feedersData.dtr.lastCommunication || null
        };

        res.json({
            success: true,
            data: {
                dtr: mappedDTR,
                feeders: mappedFeeders,
                totalFeeders: mappedFeeders.length
            },
            message: 'Feeders fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching feeders for DTR:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feeders for DTR',
            error: error.message
        });
    }
};

export const getDTRAlerts = async (req, res) => {
    try {
        // Get user's location from req.user (populated by middleware)
        const userLocationId = req.user?.locationId;
        
        // Only pass locationId if it's not null/undefined (null = show all data)
        const locationIdForFilter = userLocationId || null;
        
        // Get alerts from escalation_notifications table (same as DTRDetail and Feeders pages)
        const alerts = await prisma.escalation_notifications.findMany({
            where: locationIdForFilter ? {
                meters: {
                    dtrs: {
                        locationId: locationIdForFilter
                    }
                }
            } : {},
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
            orderBy: { createdat: 'desc' },
            take: 10 // Limit to latest 10 alerts for dashboard
        });
        
        // Map alerts to match frontend table columns exactly
        const mappedAlerts = alerts.map(alert => ({
            alertId: alert.id || 'NA',
            type: alert.type || alert.abnormalitytype || 'NA',
            feederName: alert.meternumber || alert.meters?.meterNumber || alert.meters?.serialNumber || 'N/A',
            occuredOn: alert.createdat ? new Date(alert.createdat).toLocaleString() : 'NA',
            status: alert.status || 'NA',
            dtrNumber: alert.dtrnumber || alert.meters?.dtrs?.dtrNumber || 'N/A'
        }));

        res.json({
            success: true,
            data: mappedAlerts,
            message: 'DTR alerts fetched successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error fetching DTR alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DTR alerts',
            error: error.message
        });
    }
};

export const getDTRAlertsTrends = async (req, res) => {
    try {
        const userLocationId = req.user?.locationId;
        
        // Only pass locationId if it's not null/undefined (null = show all data)
        const locationIdForFilter = userLocationId || null;
        
        // Pass locationId to DTRDB method (null = all data, locationId = filtered data)
        const trends = await DTRDB.getDTRAlertsTrends(locationIdForFilter);
        
        res.json({
            success: true,
            data: trends,
            message: 'DTR alerts trends fetched successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error fetching DTR alerts trends:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DTR alerts trends',
            error: error.message
        });
    }
};

export const getDTRStats = async (req, res) => {
    try {
        const stats = await DTRDB.getDTRStats();
        
        // Map stats to match frontend card field names exactly
        const mappedStats = {
            totalDtrs: stats.totalDTRs || 0,
            totalLtFeeders: stats.totalLTFeeders || 0,
            totalFuseBlown: stats.totalFuseBlown || 0,
            fuseBlownPercentage: stats.percentTotalFuseBlown || 0,
            overloadedFeeders: stats.overloadedDTRs || 0,
            overloadedPercentage: stats.percentOverloadedFeeders || 0,
            underloadedFeeders: stats.underloadedDTRs || 0,
            underloadedPercentage: stats.percentUnderloadedFeeders || 0,
            ltSideFuseBlown: stats.ltFuseBlown || 0,
            unbalancedDtrs: stats.unbalancedDTRs || 0,
            unbalancedPercentage: stats.percentUnbalancedDTRs || 0,
            powerFailureFeeders: stats.powerFailureFeeders || 0,
            powerFailurePercentage: stats.percentPowerFailureFeeders || 0,
            htSideFuseBlown: stats.htFuseBlown || 0,
            activeDtrs: stats.activeDTRs || 0,
            activePercentage: stats.activeDTRs && stats.totalDTRs ? ((stats.activeDTRs / stats.totalDTRs) * 100).toFixed(2) : 0,
            inactiveDtrs: stats.inactiveDTRs || 0,
            inactivePercentage: stats.inactiveDTRs && stats.totalDTRs ? ((stats.inactiveDTRs / stats.totalDTRs) * 100).toFixed(2) : 0
        };

        res.json({
            success: true,
            data: mappedStats,
            message: 'DTR stats fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching DTR stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DTR stats',
            error: error.message
        });
    }
};

export const getConsumptionStats = async (req, res) => {
    try {
        const stats = await DTRDB.getConsumptionStats();
        
        // Map consumption stats to match frontend card field names exactly
        const mappedStats = {
            totalKwh: stats.totalKWh || '0',
            totalKvah: stats.totalKVAh || '0',
            totalKw: stats.totalKW || '0',
            totalKva: stats.totalKVA || '0'
        };

        res.json({
            success: true,
            data: mappedStats,
            message: 'Consumption stats fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching consumption stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch consumption stats',
            error: error.message
        });
    }
};

export const getFeederStats = async (req, res) => {
    try {
        const { dtrId } = req.params;
        const stats = await DTRDB.getFeederStats(dtrId);
        res.json({
            success: true,
            data: stats,
            message: 'Feeder stats fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching feeder stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feeder stats',
            error: error.message
        });
    }
};

export const getInstantaneousStats = async (req, res) => {
    try {
        const { dtrId } = req.params;
        const stats = await DTRDB.getInstantaneousStats(dtrId);

        res.json({
            success: true,
            data: stats,
            message: 'Instantaneous stats fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching instantaneous stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch instantaneous stats',
            error: error.message
        });
    }
};

export const getConsolidatedDTRStats = async (req, res) => {
    try {
        // Get user's location from req.user (populated by middleware)
        const userLocationId = req.user?.locationId;
        
        // Only pass locationId if it's not null/undefined (null = show all data)
        const locationIdForFilter = userLocationId || null;
        
        // Pass locationId to DTRDB method (null = all data, locationId = filtered data)
        const stats = await DTRDB.getConsolidatedDTRStats(locationIdForFilter);
        
        res.json({
            success: true,
            data: stats,
            message: 'Consolidated DTR stats fetched successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error fetching consolidated DTR stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch consolidated DTR stats',
            error: error.message
        });
    }
}; 

export const getDTRConsumptionAnalytics = async (req, res) => {
    try {
        const { dtrId } = req.params;
        

        
        const consumptionOnDaily = await DTRDB.getDTRMainGraphAnalytics(dtrId, 'daily');

        const consumptionOnMonthly = await DTRDB.getDTRMainGraphAnalytics(dtrId, 'monthly');

        
        const { dailyxAxisData, dailysums } = consumptionOnDaily.reduce(
            (acc, item) => {
                acc.dailyxAxisData.push(item.consumption_date);
                acc.dailysums.push((item.total_consumption || 0).toFixed(2));
                return acc;
            },
            { dailyxAxisData: [], dailysums: [] }
        );
        
        const daily = fillMissingDatesDyno(
            dailyxAxisData,
            dailysums,
            'DD MMM, YYYY',
            'day'
        );
        
        const { monthlyxAxisData, monthlysums } = consumptionOnMonthly.reduce(
            (acc, item) => {
                acc.monthlyxAxisData.push(
                    getDateInMYFormat(item.consumption_date)
                );
                acc.monthlysums.push((item.total_consumption || 0).toFixed(2));
                return acc;
            },
            { monthlyxAxisData: [], monthlysums: [] }
        );
        
        const monthly = fillMissingDatesDyno(
            monthlyxAxisData,
            monthlysums,
            'DD MMM, YYYY',
            'month'
        );

        const dailyData = {
            xAxisData: daily.dates,
            sums: daily.values,
        };

        const monthlyData = {
            xAxisData: monthly.dates,
            sums: monthly.values,
        };
        

        
        res.status(200).json({
            status: 'success',
            data: {
                dailyData,
                monthlyData,
            },
        });
    } catch (error) {
        console.error('Error fetching DTR consumption analytics:', {
            error: error.message,
            stack: error.stack,
            timestamp: getDateTime(),
        });

        res.status(500).json({
            status: 'error',
            message: 'An error occurred while fetching DTR consumption analytics',
            errorId: error.code || 'INTERNAL_SERVER_ERROR',
        });
    }
};

export const getIndividualDTRAlerts = async (req, res) => {
    try {
        const { dtrId } = req.params;
        const alerts = await DTRDB.getIndividualDTRAlerts(dtrId);
        
        const mappedAlerts = alerts.map(alert => ({
            alertId: alert.id || 'NA',
            type: alert.type || alert.abnormalityType || 'NA',
            feederName: alert.meterNumber || alert.meters?.meterNumber || alert.meters?.serialNumber || 'N/A',
            occuredOn: alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'NA'
        }));

        res.json({
            success: true,
            data: mappedAlerts,
            message: 'Individual DTR alerts fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching individual DTR alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch individual DTR alerts',
            error: error.message
        });
    }
};

export const getKVAMetrics = async (req, res) => {
    try {
        const { dtrId } = req.params;
        
        const kvaOnDaily = await DTRDB.getKVAMetrics(dtrId, 'daily');
        const kvaOnMonthly = await DTRDB.getKVAMetrics(dtrId, 'monthly');
        const { dailyxAxisData, dailysums } = kvaOnDaily.reduce(
            (acc, item) => {
                acc.dailyxAxisData.push(item.kva_date);
                acc.dailysums.push((item.total_kva || 0).toFixed(2));
                return acc;
            },
            { dailyxAxisData: [], dailysums: [] }
        );
        
        const daily = fillMissingDatesDyno(
            dailyxAxisData,
            dailysums,
            'DD MMM, YYYY',
            'day'
        );
        
        const { monthlyxAxisData, monthlysums } = kvaOnMonthly.reduce(
            (acc, item) => {
                acc.monthlyxAxisData.push(
                    getDateInMYFormat(item.kva_date)
                );
                acc.monthlysums.push((item.total_kva || 0).toFixed(2));
                return acc;
            },
            { monthlyxAxisData: [], monthlysums: [] }
        );
        
        const monthly = fillMissingDatesDyno(
            monthlyxAxisData,
            monthlysums,
            'DD MMM, YYYY',
            'month'
        );

        const dailyData = {
            xAxisData: daily.dates,
            sums: daily.values,
        };

        const monthlyData = {
            xAxisData: monthly.dates,
            sums: monthly.values,
        };
        
        res.status(200).json({
            status: 'success',
            data: {
                dailyData,
                monthlyData,
            },
        });
    } catch (error) {
        console.error('Error fetching DTR kVA metrics:', {
            error: error.message,
            stack: error.stack,
            timestamp: getDateTime(),
        });

        res.status(500).json({
            status: 'error',
            message: 'An error occurred while fetching DTR kVA metrics',
            errorId: error.code || 'INTERNAL_SERVER_ERROR',
        });
    }
};

export const getMeterStatus = async (req, res) => {
    try {        
        // Get user's location from req.user (populated by middleware)
        const userLocationId = req.user?.locationId;
        
        // Build where clause for location filtering
        const whereClause = {};
        if (userLocationId) {
            whereClause.locationId = userLocationId;
        }

        // Get DTRs with their meter communication status
        const dtrs = await DTRDB.getDTRTable({
            page: 1,
            pageSize: 1000, // Get all DTRs for communication status
            locationId: userLocationId
        });

        // Calculate communication statistics
        const totalDTRs = dtrs.total;
        const connectedDTRs = dtrs.data.filter(dtr => 
            dtr.lastCommunication && 
            new Date(dtr.lastCommunication) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        ).length;
        const disconnectedDTRs = totalDTRs - connectedDTRs;

        // Get meter-specific communication data
        const meterStats = {
            totalMeters: 0,
            communicatingMeters: 0,
            nonCommunicatingMeters: 0,
            lastUpdated: new Date().toISOString()
        };

        // Count meters associated with DTRs
        for (const dtr of dtrs.data) {
            meterStats.totalMeters += dtr.feedersCount || 0;
            
            // If DTR is communicating, assume its meters are too
            if (dtr.lastCommunication && 
                new Date(dtr.lastCommunication) > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
                meterStats.communicatingMeters += dtr.feedersCount || 0;
            } else {
                meterStats.nonCommunicatingMeters += dtr.feedersCount || 0;
            }
        }

        // Format data to match frontend expectations
        const responseData = [
            { 
                value: meterStats.communicatingMeters, 
                name: "Communicating" 
            },
            { 
                value: meterStats.nonCommunicatingMeters, 
                name: "Non-Communicating" 
            }
        ];


        res.json({
            success: true,
            data: responseData,
            message: 'Meter communication status retrieved successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });

    } catch (error) {
        console.error('❌ Error fetching meter status:', {
            error: error.message,
            stack: error.stack,
            timestamp: getDateTime(),
        });

        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching meter communication status',
            error: error.message
        });
    }
};

export const getFilterOptions = async (req, res) => {
    try {
        const { parentId, locationTypeId } = req.query; 
        const locationDB = new LocationDB()  
        const locations = await locationDB.getFilterOptions(parentId, locationTypeId);

        
        res.json({
            success: true,
            data: locations,
            message: 'Filter options fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch filter options',
            error: error.message
        });
    }
};

