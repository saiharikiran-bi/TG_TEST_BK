import { PrismaClient } from '@prisma/client';
import { 
    analyzeMeterReadings, 
    hasAbnormalities, 
    getAbnormalitySummary, 
    formatPowerDataForAlerts,
    convertToISTMail,
    generateErrorSignature
} from '../utils/abnormalityUtils.js';
import EmailService from '../utils/emailService.js';
import { escalationLevels } from './utils/escalationLevels.js';


const prisma = new PrismaClient();

// Store previous error states to prevent duplicate alerts (like TGNPDCL_Backend)
const previousErrorStates = new Map();

// Helper function to get all unique phone numbers from escalation levels
const getAllEscalationPhoneNumbers = () => {
    const phoneNumbers = new Set();
    escalationLevels.forEach(level => {
        level.contacts.forEach(contact => {
            if (contact.phone) {
                phoneNumbers.add(contact.phone);
            }
        });
    });
    return Array.from(phoneNumbers);
};

// Helper function to check if abnormality is still active for a meter
const checkIfAbnormalityActive = async (meterId) => {
    try {
        // Get the latest reading for this meter
        const latestReading = await prisma.meter_readings.findFirst({
            where: { meterId: meterId },
            orderBy: { readingDate: 'desc' }
        });
        
        if (!latestReading) {
            return false; // No reading means no abnormality
        }
        
        // Analyze the reading for abnormalities
        const abnormalities = analyzeMeterReadings(latestReading);
        const hasAbnormalitiesDetected = hasAbnormalities(abnormalities);
        
        return hasAbnormalitiesDetected;
    } catch (error) {
        console.error(`❌ [CRON-METER] Error checking abnormality status for meter ${meterId}:`, error);
        return false; // Assume resolved if error
    }
};

// Store scheduled timeouts so we can cancel them if needed
const scheduledNotifications = new Map();

// Function to cancel scheduled notifications for a specific meter
const cancelScheduledNotifications = (meterId) => {
    let cancelledCount = 0;
    
    // Cancel all scheduled notifications for this meter
    for (const [key, timeoutId] of scheduledNotifications.entries()) {
        if (key.startsWith(`${meterId}-`)) {
                            clearTimeout(timeoutId);
                            scheduledNotifications.delete(key);
                            cancelledCount++;
        }
    }
    
    if (cancelledCount > 0) {
        console.log(`⏹️ [CRON-METER] Cancelled ${cancelledCount} scheduled notifications for meter ${meterId}`);
    }
};

// Helper function to send SMS for a specific level
const sendLevelNotification = async (notification, phoneNumbers, levelName) => {
    try {
        console.log(`📱 [CRON-METER] Sending ${levelName} SMS for meter ${notification.meterNumber}`);
        
        for (const phone of phoneNumbers) {
            try {
                await EmailService.sendSMS(
                    phone,
                    process.env.MSG_TEMPLATE_ID,
                    {
                        var: notification.dtrnumber,           // ##var## -> DTR number (e.g., DTR-002)
                        var1: notification.meternumber,       // ##var1## -> Meter number (e.g., 23010587) - using as feeder name
                        var2: notification.abnormalitytype,   // ##var2## -> Abnormality Values (e.g., HT Fuse Blown (R - Phase))
                        var3: new Date().toLocaleString()     // ##var3## -> Occurred at (timestamp)
                    }
                );
                console.log(`✅ [CRON-METER] ${levelName} SMS sent to ${phone}`);
            } catch (smsError) {
                console.error(`❌ [CRON-METER] Failed to send ${levelName} SMS to ${phone}:`, smsError);
            }
        }
        
        // Mark notification as sent
        await prisma.escalation_notifications.update({
            where: { id: notification.id },
            data: { 
                sentat: new Date(),
                status: 'sent'
            }
        });
        
        console.log(`✅ [CRON-METER] ${levelName} notification marked as sent`);
    } catch (error) {
        console.error(`❌ [CRON-METER] Failed to send ${levelName} notification:`, error);
    }
};

/**
 * Check meter readings for abnormalities and send alerts directly
 * This cron job runs every minute to monitor all meters
 * EXACTLY like TGNPDCL_Backend implementation
 */
export async function checkMeterAbnormalities() {
    try {
        console.log('🔍 [CRON-METER] Starting meter abnormality check...');
        console.log('⏰ [CRON-METER] Timestamp:', new Date().toISOString());

        // Get all active meters with their latest readings (like TGNPDCL_Backend)
        const meters = await prisma.meters.findMany({
            where: {
                status: 'ACTIVE',
                isInUse: true
            },
            include: {
                locations: {
                    include: {
                        dtrs: {
                            select: {
                                dtrNumber: true
                            }
                        }
                    }
                },
                dtrs: {
                    select: {
                        dtrNumber: true
                    }
                },
                meter_readings: {
                    orderBy: {
                        readingDate: 'desc'
                    },
                    take: 1
                }
            }
        });

        console.log(`📊 [CRON-METER] Found ${meters.length} active meters to check`);

        let totalAbnormalities = 0;
        let alertsSent = 0;

        for (const meter of meters) {
            try {
                if (!meter.meter_readings || meter.meter_readings.length === 0) {
                    console.log(`⚠️ [CRON-METER] No readings found for meter ${meter.meterNumber}`);
                    continue;
                }

                const latestReading = meter.meter_readings[0];
                
                // Debug: Log the meter data structure
                console.log(`🔍 [DEBUG] Meter ${meter.meterNumber} data:`, {
                    meterId: meter.id,
                    dtrId: meter.dtrId,
                    dtrs: meter.dtrs,
                    locations: meter.locations,
                    locationDtrs: meter.locations?.dtrs
                });
                
                // Try to get DTR number from the meter's DTR relationship
                let dtrNumber = meter.dtrs?.dtrNumber;
                
                // If no DTR found, try to get it from the location's DTRs
                if (!dtrNumber && meter.locations?.dtrs && meter.locations.dtrs.length > 0) {
                    dtrNumber = meter.locations.dtrs[0]?.dtrNumber;
                }
                
                // If still no DTR, try to get it from the meter's dtrId field
                if (!dtrNumber && meter.dtrId) {
                    dtrNumber = `DTR-${meter.dtrId}`;
                }
                
                // Final fallback
                dtrNumber = dtrNumber || 'Unknown DTR';
                
                const meterNumber = meter.meterNumber || 'Unknown Meter';
                
                // Debug: Log the extracted values
                console.log(`🔍 [DEBUG] Extracted values for meter ${meter.meterNumber}:`, {
                    dtrNumber,
                    meterNumber
                });

                // Analyze the reading for abnormalities (like TGNPDCL_Backend)
                const abnormalities = analyzeMeterReadings(latestReading);
                const hasAbnormalitiesDetected = hasAbnormalities(abnormalities);

                if (hasAbnormalitiesDetected) {
                    totalAbnormalities++;
                    console.log(`🚨 [CRON-METER] Abnormalities detected for meter ${meter.meterNumber}:`, getAbnormalitySummary(abnormalities));

                    // Format power data for alerts (like TGNPDCL_Backend)
                    const powerData = formatPowerDataForAlerts(latestReading);
                    
                    // Generate error signature based on actual meter reading VALUES
                    const errorSignature = generateErrorSignature(abnormalities, powerData);
                    
                    // Check if this exact reading state has already been alerted
                    const previousSignature = previousErrorStates.get(meter.serialNumber);
                    
                    if (previousSignature !== errorSignature) {
                        try {
                            // Check if we already have active notifications for this meter
                            const existingNotifications = await prisma.escalation_notifications.findMany({
                                where: {
                                    meterid: meter.id,
                                    status: 'active',
                                    resolvedat: null
                                }
                            });

                            if (existingNotifications.length === 0) {
                                // No active notifications, create new ones
                                console.log(`📱 [CRON-METER] Creating new escalation notifications for meter ${meter.meterNumber}`);
                                
                                const abnormalityType = getAbnormalitySummary(abnormalities);
                                const phoneNumbers = getAllEscalationPhoneNumbers();
                                
                                if (phoneNumbers && phoneNumbers.length > 0) {
                                    // Create notification records for each abnormality type
                                    const notificationPromises = [];
                                    
                                    // Get individual abnormalities
                                    const individualAbnormalities = Array.isArray(abnormalityType) ? abnormalityType : [abnormalityType];
                                    
                                    for (const abnormality of individualAbnormalities) {
                                        for (const level of escalationLevels) {
                                            const notification = await prisma.escalation_notifications.create({
                                                data: {
                                                    meterid: meter.id,
                                                    type: abnormality, // Store specific abnormality type
                                                    level: level.level,
                                                    message: `Level ${level.level}: ${abnormality} detected for DTR: ${dtrNumber}, Meter: ${meterNumber}`,
                                                    status: 'active',
                                                    createdat: new Date(),
                                                    scheduledfor: level.timeToEscalate > 0 
                                                        ? new Date(Date.now() + (level.timeToEscalate * 60 * 1000))
                                                        : new Date(),
                                                    dtrnumber: dtrNumber,
                                                    meternumber: meterNumber,
                                                    abnormalitytype: abnormality
                                                }
                                            });
                                            notificationPromises.push(notification);
                                        }
                                    }

                                    const notifications = await Promise.all(notificationPromises);
                                    console.log(`✅ [CRON-METER] Created ${notifications.length} notification records`);

                                    // Group notifications by level for proper scheduling
                                    const notificationsByLevel = {};
                                    notifications.forEach(notification => {
                                        if (!notificationsByLevel[notification.level]) {
                                            notificationsByLevel[notification.level] = [];
                                        }
                                        notificationsByLevel[notification.level].push(notification);
                                    });
                                    
                                    // Send immediate Level 0 SMS for all abnormalities
                                    if (notificationsByLevel[0]) {
                                        for (const notification of notificationsByLevel[0]) {
                                            await sendLevelNotification(notification, phoneNumbers, 'Level 0');
                                        }
                                    }
                                    
                                    // Schedule other levels
                                    for (let level = 1; level < escalationLevels.length; level++) {
                                        const levelConfig = escalationLevels[level];
                                        if (levelConfig.timeToEscalate > 0 && notificationsByLevel[level]) {
                                            const delayMs = levelConfig.timeToEscalate * 60 * 1000;
                                            const timeoutId = setTimeout(async () => {
                                                // Check if abnormality is still active before sending
                                                const isStillActive = await checkIfAbnormalityActive(meter.id);
                                                if (isStillActive) {
                                                    for (const notification of notificationsByLevel[level]) {
                                                        await sendLevelNotification(notification, phoneNumbers, `Level ${level}`);
                                                    }
                                                } else {
                                                    console.log(`⏭️ [CRON-METER] Abnormality resolved for meter ${meter.meterNumber} - skipping Level ${level}`);
                                                    // Mark all notifications for this level as resolved
                                                    for (const notification of notificationsByLevel[level]) {
                                                        await prisma.escalation_notifications.update({
                                                            where: { id: notification.id },
                                                            data: { 
                                                                status: 'resolved',
                                                                resolvedat: new Date()
                                                            }
                                                        });
                                                    }
                                                }
                                            }, delayMs);
                                            
                                            // Store the timeout ID so we can cancel it if needed
                                            const key = `${meter.id}-${level}`;
                                            scheduledNotifications.set(key, timeoutId);
                                        }
                                    }
                                }
                            } else {
                                console.log(`⏭️ [CRON-METER] Skipping - ${existingNotifications.length} active notifications already exist for meter ${meter.meterNumber}`);
                            }

                            // Update the error state signature
                            previousErrorStates.set(meter.serialNumber, errorSignature);
                            
                            console.log(`✅ [CRON-METER] Escalation notifications handled for meter ${meter.meterNumber}`);
                            alertsSent++;
                        } catch (alertError) {
                            console.error(`❌ [CRON-METER] Failed to handle escalation notifications for meter ${meter.meterNumber}:`, alertError);
                        }
                    } else {
                        console.log(`⏭️ [CRON-METER] Skipping - all abnormalities are duplicates for meter ${meter.meterNumber}`);
                    }
                    
                } else {
                    // Clear previous error state if no abnormalities detected (like TGNPDCL_Backend)
                    if (previousErrorStates.has(meter.serialNumber)) {
                        previousErrorStates.delete(meter.serialNumber);
                        console.log(`🔄 [CRON-METER] Cleared error state for meter ${meter.serialNumber} - no abnormalities detected`);
                        
                        // Mark all active notifications as resolved
                        try {
                            await prisma.escalation_notifications.updateMany({
                                where: {
                                    meterid: meter.id,
                                    status: { in: ['active', 'sent'] },
                                    resolvedat: null
                                },
                                data: {
                                    status: 'resolved',
                                    resolvedat: new Date()
                                }
                            });
                            console.log(`✅ [CRON-METER] Marked all notifications as resolved for meter ${meter.meterNumber}`);
                            
                            // Cancel all scheduled notifications for this meter
                            cancelScheduledNotifications(meter.id);
                        } catch (resolveError) {
                            console.error(`❌ [CRON-METER] Failed to resolve notifications for meter ${meter.meterNumber}:`, resolveError);
                        }
                    }
                }

            } catch (error) {
                console.error(`❌ [CRON-METER] Error processing meter ${meter.meterNumber}:`, error);
            }
        }

        console.log(`✅ [CRON-METER] Meter abnormality check completed`);
        console.log(`📊 [CRON-METER] Summary: ${totalAbnormalities} meters with abnormalities, ${alertsSent} alerts sent`);

        return {
            totalMeters: meters.length,
            metersWithAbnormalities: totalAbnormalities,
            alertsSent: alertsSent,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ [CRON-METER] Critical error in meter abnormality check:', error);
        throw error;
    }
}

/**
 * Get meter readings for a specific meter
 * @param {number} meterId - The meter ID
 * @param {number} limit - Number of readings to return
 * @returns {Array} - Array of meter readings
 */
export async function getMeterReadings(meterId, limit = 10) {
    try {
        const readings = await prisma.meter_readings.findMany({
            where: { meterId: parseInt(meterId) },
            orderBy: { readingDate: 'desc' },
            take: parseInt(limit)
        });

        return readings;
    } catch (error) {
        console.error('Error fetching meter readings:', error);
        throw error;
    }
}

/**
 * Get the latest meter reading for a specific meter
 * @param {number} meterId - The meter ID
 * @returns {Object|null} - The latest meter reading or null
 */
export async function getLatestMeterReading(meterId) {
    try {
        const reading = await prisma.meter_readings.findFirst({
            where: { meterId: parseInt(meterId) },
            orderBy: { readingDate: 'desc' }
        });

        return reading;
    } catch (error) {
        console.error('Error fetching latest meter reading:', error);
        throw error;
    }
}

/**
 * Check abnormalities for a specific meter
 * @param {number} meterId - The meter ID
 * @returns {Object} - Analysis result for the meter
 */
export async function checkSpecificMeterAbnormalities(meterId) {
    try {
        const meter = await prisma.meters.findUnique({
            where: { id: parseInt(meterId) },
            include: {
                locations: {
                    include: {
                        dtrs: {
                            select: {
                                dtrNumber: true
                            }
                        }
                    }
                },
                dtrs: {
                    select: {
                        dtrNumber: true
                    }
                },
                meter_readings: {
                    orderBy: {
                        readingDate: 'desc'
                    },
                    take: 1
                }
            }
        });

        if (!meter) {
            throw new Error('Meter not found');
        }

        if (!meter.meter_readings || meter.meter_readings.length === 0) {
            throw new Error('No readings found for this meter');
        }

        const latestReading = meter.meter_readings[0];
        
        // Try to get DTR number from the meter's DTR relationship
        let dtrName = meter.dtrs?.dtrNumber;
        
        // If no DTR found, try to get it from the location's DTRs
        if (!dtrName && meter.locations?.dtrs && meter.locations.dtrs.length > 0) {
            dtrName = meter.locations.dtrs[0]?.dtrNumber;
        }
        
        // If still no DTR, try to get it from the meter's dtrId field
        if (!dtrName && meter.dtrId) {
            dtrName = `DTR-${meter.dtrId}`;
        }
        
        // Final fallback
        dtrName = dtrName || 'Unknown DTR';
        
        const feederName = meter.locations?.name || 'Unknown Feeder';

        // Analyze the reading for abnormalities
        const abnormalities = analyzeMeterReadings(latestReading);
        const hasAbnormalitiesDetected = hasAbnormalities(abnormalities);
        const powerData = formatPowerDataForAlerts(latestReading);

        return {
            meterId: parseInt(meterId),
            meterNumber: meter.meterNumber,
            serialNumber: meter.serialNumber,
            dtrName,
            feederName,
            readingDate: latestReading.readingDate,
            abnormalities,
            hasAbnormalities: hasAbnormalitiesDetected,
            abnormalitySummary: getAbnormalitySummary(abnormalities),
            powerData,
            errorSignature: generateErrorSignature(abnormalities, powerData)
        };

    } catch (error) {
        console.error('Error checking specific meter abnormalities:', error);
        throw error;
    }
}

export default {
    checkMeterAbnormalities
};
