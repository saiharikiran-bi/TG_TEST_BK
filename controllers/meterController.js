import MeterDB from '../models/MeterDB.js';

// Helper functions for data aggregation
function getDailyReadings(readings) {
    const today = new Date();
    const dailyData = [];
    
    // Get last 7 days starting from Monday
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        const dayReadings = readings.filter(reading => {
            const readingDate = new Date(reading.readingDate);
            return readingDate.toDateString() === date.toDateString();
        });
        
        if (dayReadings.length > 0) {
            const totalKWh = dayReadings.reduce((sum, r) => sum + (r.kWh || 0), 0);
            const totalKW = dayReadings.reduce((sum, r) => sum + (r.kW || 0), 0);
            const avgKW = totalKW / dayReadings.length;
            
            dailyData.push({
                date: date.toISOString(),
                kWh: totalKWh,
                kW: avgKW,
                label: date.toLocaleDateString('en-US', { weekday: 'short' })
            });
        } else {
            dailyData.push({
                date: date.toISOString(),
                kWh: 0,
                kW: 0,
                label: date.toLocaleDateString('en-US', { weekday: 'short' })
            });
        }
    }
    
    return dailyData;
}

function getWeeklyReadings(readings) {
    const today = new Date();
    const weeklyData = [];
    
    // Get last 4 weeks, each week Monday to Sunday
    for (let i = 3; i >= 0; i--) {
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() - (i * 7));
        
        // Find the previous Monday (start of week)
        const weekStart = new Date(weekEnd);
        const dayOfWeek = weekEnd.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 = Sunday, 1 = Monday
        weekStart.setDate(weekEnd.getDate() - daysToMonday);
        
        const weekReadings = readings.filter(reading => {
            const readingDate = new Date(reading.readingDate);
            return readingDate >= weekStart && readingDate <= weekEnd;
        });
        
        if (weekReadings.length > 0) {
            const totalKWh = weekReadings.reduce((sum, r) => sum + (r.kWh || 0), 0);
            const totalKW = weekReadings.reduce((sum, r) => sum + (r.kW || 0), 0);
            const avgKW = totalKW / weekReadings.length;
            
            weeklyData.push({
                startDate: weekStart.toISOString(),
                endDate: weekEnd.toISOString(),
                kWh: totalKWh,
                kW: avgKW,
                label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            });
        } else {
            weeklyData.push({
                startDate: weekStart.toISOString(),
                endDate: weekEnd.toISOString(),
                kWh: 0,
                kW: 0,
                label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            });
        }
    }
    
    return weeklyData;
}

function getMonthlyReadings(readings) {
    const today = new Date();
    const monthlyData = [];
    
    // Get all 12 months of the current year
    for (let month = 0; month < 12; month++) {
        const monthStart = new Date(today.getFullYear(), month, 1);
        const monthEnd = new Date(today.getFullYear(), month + 1, 0);
        
        const monthReadings = readings.filter(reading => {
            const readingDate = new Date(reading.readingDate);
            return readingDate >= monthStart && readingDate <= monthEnd;
        });
        
        if (monthReadings.length > 0) {
            const totalKWh = monthReadings.reduce((sum, r) => sum + (r.kWh || 0), 0);
            const totalKW = monthReadings.reduce((sum, r) => sum + (r.kW || 0), 0);
            const avgKW = totalKW / monthReadings.length;
            
            monthlyData.push({
                startDate: monthStart.toISOString(),
                endDate: monthEnd.toISOString(),
                kWh: totalKWh,
                kW: avgKW,
                label: monthStart.toLocaleDateString('en-US', { month: 'short' })
            });
        } else {
            monthlyData.push({
                startDate: monthStart.toISOString(),
                endDate: monthEnd.toISOString(),
                kWh: 0,
                kW: 0,
                label: monthStart.toLocaleDateString('en-US', { month: 'short' })
            });
        }
    }
    
    return monthlyData;
}

// Get all meters
export const getAllMeters = async (req, res) => {
    try {
        const userLocationId = req.user?.locationId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const filters = {
            status: req.query.status && req.query.status !== 'all' ? req.query.status : undefined,
            type: req.query.type && req.query.type !== 'all' ? req.query.type : undefined,
            manufacturer: req.query.manufacturer && req.query.manufacturer !== 'all' ? req.query.manufacturer : undefined,
            location: req.query.location && req.query.location !== 'all' ? req.query.location : undefined,
        };
        const metersData = await MeterDB.getMetersTable(page, limit, filters, userLocationId);
        const formatted = metersData.data.map((m, idx) => {
            return {
                sNo: (page - 1) * limit + idx + 1,
                meterSerialNumber: m.meterNumber || 'NA',
                modemSerialNumber: m.serialNumber || 'NA',
                meterType: m.type || m.meterType || 'NA',
                meterMake: m.manufacturer || 'NA',
                consumerName: m.bills?.[0]?.consumers?.name || 'NA',
                location: m.locations?.name || 'NA',
                installationDate: m.installationDate || m.createdAt || 'NA',
            };
        });
        res.json({
            success: true,
            data: formatted,
            pagination: metersData.pagination,
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error fetching meters:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch meters',
            error: error.message
        });
    }
};

export const getMeterById = async (req, res) => {
    try {
        const { id } = req.params;
        const userLocationId = req.user?.locationId;
        
        const meter = await MeterDB.findByMeterNumber(id);
        
        if (!meter) {
            return res.status(404).json({
                success: false,
                message: 'Meter not found'
            });
        }

        // Check if user has access to this meter based on location
        if (userLocationId && meter.locationId !== userLocationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only access meters from your assigned location'
            });
        }

        // Debug: Log what we're getting from database
        console.log('🔍 Raw meter data from database:', {
            hasMeterConfig: !!meter.meter_configurations,
            hasBills: !!meter.bills,
            hasCurrentTransformers: !!meter.current_transformers,
            hasPotentialTransformers: !!meter.potential_transformers,
            meterConfig: meter.meter_configurations,
            bills: meter.bills,
            currentTransformers: meter.current_transformers,
            potentialTransformers: meter.potential_transformers
        });
        
        // Debug: Log meter readings specifically
        console.log('📊 Meter readings debug:', {
            hasMeterReadings: !!meter.meter_readings,
            meterReadingsCount: meter.meter_readings?.length || 0,
            sampleReadings: meter.meter_readings?.slice(0, 3).map(r => ({
                date: r.readingDate,
                kWh: r.kWh,
                kW: r.kW
            })) || []
        });

        // Format the response for frontend
        const formattedMeter = {
            id: meter.id,
            meterNumber: meter.meterNumber,
            serialNumber: meter.serialNumber,
            manufacturer: meter.manufacturer,
            model: meter.model,
            type: meter.type,
            phase: meter.phase,
            status: meter.status,
            installationDate: meter.installationDate,
            location: meter.locations?.name || 'N/A',
            locationCode: meter.locations?.code || 'N/A',
            currentReading: meter.meter_readings?.[0]?.kVAh || 0,
            lastReadingDate: meter.meter_readings?.[0]?.readingDate || null,
            dtrInfo: meter.dtrs ? {
                dtrNumber: meter.dtrs.dtrNumber,
                capacity: meter.dtrs.capacity,
                type: meter.dtrs.type
            } : null,
            // Add meter configuration data
            meterConfig: meter.meter_configurations ? {
                ctRatio: meter.meter_configurations.ctRatio || 'N/A',
                ptRatio: meter.meter_configurations.ptRatio || 'N/A',
                adoptedCTRatio: meter.meter_configurations.adoptedCTRatio || 'N/A',
                adoptedPTRatio: meter.meter_configurations.adoptedPTRatio || 'N/A',
                mf: meter.meter_configurations.mf || 'N/A'
            } : null,
            // Add consumer information if available
            consumerInfo: meter.bills?.[0]?.consumers ? {
                name: meter.bills[0].consumers.name || 'N/A',
                consumerNumber: meter.bills[0].consumers.consumerNumber || 'N/A'
            } : null,
                            // Add current and potential transformer info (disabled due to schema issues)
                currentTransformers: null, // meter.current_transformers || null,
                potentialTransformers: null, // meter.potential_transformers || null,
                // Add meter readings for different time ranges (Daily, Weekly, Monthly)
                meterReadings: meter.meter_readings?.length > 0 ? meter.meter_readings
                    .sort((a, b) => new Date(b.readingDate) - new Date(a.readingDate))
                    .slice(0, 30) // Get more data for weekly/monthly calculations
                    .reverse()
                    .map(reading => ({
                        date: reading.readingDate,
                        kWh: reading.kWh || 0,
                        kW: reading.kW || 0,
                        consumption: reading.consumption || 0
                    })) : [],
                
                // Add aggregated data for different time ranges
                meterReadingsAggregated: meter.meter_readings?.length > 0 ? {
                    daily: getDailyReadings(meter.meter_readings),
                    weekly: getWeeklyReadings(meter.meter_readings),
                    monthly: getMonthlyReadings(meter.meter_readings)
                } : null
            };

        // Debug: Log the final processed meterReadings
        console.log('🎯 Final processed meterReadings:', {
            count: formattedMeter.meterReadings.length,
            data: formattedMeter.meterReadings
        });

        res.json({
            success: true,
            data: formattedMeter,
            message: 'Meter retrieved successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error fetching meter:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch meter',
            error: error.message
        });
    }
};

export const createMeter = async (req, res) => {
    try {
        const meterData = req.validatedData;
        const userLocationId = req.user?.locationId;

        // Assign user's location to the new meter if available
        if (userLocationId) {
            meterData.locationId = userLocationId;
        }

        const newMeter = await MeterDB.create(meterData);

        res.status(201).json({
            success: true,
            data: newMeter,
            message: 'Meter created successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error creating meter:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create meter'
        });
    }
};

export const updateMeter = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const userLocationId = req.user?.locationId;

        // Check if user has access to this meter based on location
        if (userLocationId) {
            const existingMeter = await MeterDB.findByMeterNumber(id);
            if (existingMeter && existingMeter.locationId !== userLocationId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You can only update meters from your assigned location'
                });
            }
        }

        const updatedMeter = await MeterDB.updateMeter(id, updateData);

        res.json({
            success: true,
            data: updatedMeter,
            message: 'Meter updated successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error updating meter:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update meter',
            error: error.message
        });
    }
};

export const deleteMeter = async (req, res) => {
    try {
        const { id } = req.params;
        const userLocationId = req.user?.locationId;

        // Check if user has access to this meter based on location
        if (userLocationId) {
            const existingMeter = await MeterDB.findByMeterNumber(id);
            if (existingMeter && existingMeter.locationId !== userLocationId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You can only delete meters from your assigned location'
                });
            }
        }

        const deletedMeter = await MeterDB.deleteMeter(id);

        res.json({
            success: true,
            data: deletedMeter,
            message: 'Meter deleted successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error deleting meter:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete meter',
            error: error.message
        });
    }
}; 

export const getMeterStats = async (req, res) => {
    try {
        const userLocationId = req.user?.locationId;
        const stats = await MeterDB.getMeterStats(userLocationId);
        res.json({
            success: true,
            data: {
                totalMeters: stats.totalMeters,
                makes: stats.makes,
                types: stats.types,
                connectionTypes: stats.connectionTypes
            },
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('❌ getMeterStats: Error fetching meter stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch meter statistics',
            error: error.message
        });
    }
};



export const getMeterView = async (req, res) => {
    try {
        const { id } = req.params;
        const userLocationId = req.user?.locationId;
        
        const meter = await MeterDB.findByMeterNumber(id);
        if (!meter) {
            return res.status(404).json({
                success: false,
                message: 'Meter not found'
            });
        }

        // Check if user has access to this meter based on location
        if (userLocationId && meter.locationId !== userLocationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only access meters from your assigned location'
            });
        }

        res.json({
            success: true,
            data: meter,
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('❌ getMeterView: Error fetching meter:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch meter',
            error: error.message
        });
    }
}; 

export const getDataLoggersList = async (req, res) => {
    try {
        const userLocationId = req.user?.locationId;
        const dataLoggers = await MeterDB.getDataLoggersList(userLocationId);
        
        const formatted = dataLoggers.map((logger, idx) => ({
            sNo: idx + 1,
            modemId: logger.modem_id,
            modemSlNo: logger.modem_sl_no,
            hwVersion: logger.hw_version || 'NA',
            fwVersion: logger.fw_version || 'NA',
            mobile: logger.mobile || 'NA',
            deliveryDate: logger.delivery_date ? new Date(logger.delivery_date).toLocaleDateString() : 'NA',
            imei: logger.imei || 'NA',
            simno: logger.simno || 'NA',
            changedBy: logger.changed_by || 'NA',
            changedDatetime: logger.changed_datetime || 'NA',
            ip: logger.ip || 'NA',
            logTimestamp: logger.log_timestamp ? new Date(logger.log_timestamp).toLocaleString() : 'NA',
            simNo: logger.sim_no || 'NA',
            // Meter details
            meterId: logger.meter?.id,
            meterNumber: logger.meter?.meterNumber || 'NA',
            serialNumber: logger.meter?.serialNumber || 'NA',
            manufacturer: logger.meter?.manufacturer || 'NA',
            model: logger.meter?.model || 'NA',
            type: logger.meter?.type || 'NA',
            status: logger.meter?.status || 'NA',
            installationDate: logger.meter?.installationDate ? new Date(logger.meter.installationDate).toLocaleDateString() : 'NA',
            // Consumer details
            consumerNumber: logger.meter?.bills?.[0]?.consumers?.consumerNumber || 'NA',
            consumerName: logger.meter?.bills?.[0]?.consumers?.name || 'NA',
            consumerPhone: logger.meter?.bills?.[0]?.consumers?.primaryPhone || 'NA',
            consumerEmail: logger.meter?.bills?.[0]?.consumers?.email || 'NA',
            // Location details
            locationName: logger.meter?.location?.name || 'NA',
            locationCode: logger.meter?.location?.code || 'NA',
            locationAddress: logger.meter?.location?.address || 'NA'
        }));

        res.json({
            success: true,
            data: formatted,
            message: 'Data loggers retrieved successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('❌ getDataLoggersList: Error fetching data loggers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch data loggers',
            error: error.message
        });
    }
}; 

export const getMeterHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const userLocationId = req.user?.locationId;
        
        const meter = await MeterDB.findByMeterNumber(id);
        
        if (!meter) {
            return res.status(404).json({
                success: false,
                message: 'Meter not found'
            });
        }

        // Check if user has access to this meter based on location
        if (userLocationId && meter.locationId !== userLocationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only access meters from your assigned location'
            });
        }

        // Format the data for the frontend table columns
        const formattedMeter = {
            slNo: 1,
            meterSlNo: meter.meterNumber || 'N/A',
            modemSlNo: meter.modem?.modem_sl_no || 'N/A',
            meterType: meter.type || 'N/A',
            meterMake: meter.manufacturer || 'N/A',
            consumerName: meter.bills?.[0]?.consumers?.name || 'N/A',
            location: meter.locations?.name || 'N/A',
            installationDate: meter.installationDate ? new Date(meter.installationDate).toLocaleDateString() : 'N/A'
        };

        res.json({
            success: true,
            data: formattedMeter,
            message: 'Meter details retrieved successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('❌ getMeterHistory: Error fetching meter history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch meter details',
            error: error.message
        });
    }
};