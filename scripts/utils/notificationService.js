import NotificationDB from '../models/NotificationDB.js';
import EmailService from './emailService.js';

class NotificationService {
    // Send zero value alert (exactly like TGNPDCL implementation)
    static async sendZeroValueAlert(meterSerial, feederName, dtrName, zeroValues, powerData, lastCommDate) {
        try {
            console.log(`🚨 [NOTIFICATION] Starting zero value alert for meter ${meterSerial}`);
            
            // Create notification first
            const notification = await NotificationDB.createNotification({
                consumerId: 1, // System consumer
                type: 'SYSTEM_ALERT',
                title: `Zero Power Values Alert - ${dtrName}`,
                message: `Meter ${meterSerial} at ${dtrName} (${feederName}) has detected zero power values. Requires immediate investigation.`,
                priority: 'URGENT',
                channels: ['PUSH', 'EMAIL', 'SMS']
            });

            // Send email and SMS alerts using EmailService (which handles both)
            try {
                await EmailService.sendZeroValueAlert(meterSerial, feederName, dtrName, zeroValues, powerData, lastCommDate);
                console.log(`📧 [NOTIFICATION] Zero value alert sent successfully for meter ${meterSerial}`);
            } catch (alertError) {
                console.error(`❌ [NOTIFICATION] Failed to send zero value alert:`, alertError);
            }

            return notification;
        } catch (error) {
            console.error('NotificationService.sendZeroValueAlert:', error);
            throw error;
        }
    }

    // Send power failure alert (exactly like TGNPDCL implementation)
    static async sendPowerFailureAlert(meterSerial, feederName, dtrName, powerData) {
        try {
            console.log(`🚨 [NOTIFICATION] Starting power failure alert for meter ${meterSerial}`);
            
            // Create notification first
            const notification = await NotificationDB.createNotification({
                consumerId: 1, // System consumer
                type: 'SYSTEM_ALERT',
                title: `Power Failure Alert - ${dtrName}`,
                message: `Meter ${meterSerial} at ${dtrName} (${feederName}) has detected power failure. Requires immediate investigation.`,
                priority: 'URGENT',
                channels: ['PUSH', 'EMAIL', 'SMS']
            });

            // Send email and SMS alerts using EmailService (which handles both)
            try {
                await EmailService.sendPowerFailureAlert(meterSerial, feederName, dtrName, powerData);
                console.log(`📧 [NOTIFICATION] Power failure alert sent successfully for meter ${meterSerial}`);
            } catch (alertError) {
                console.error(`❌ [NOTIFICATION] Failed to send power failure alert:`, alertError);
            }

            return notification;
        } catch (error) {
            console.error('NotificationService.sendPowerFailureAlert:', error);
            throw error;
        }
    }

    // Send meter abnormality alert (exactly like TGNPDCL implementation)
    static async sendMeterAbnormalityAlert(meterSerial, feederName, dtrName, abnormalityType, powerData) {
        try {
            console.log(`🚨 [NOTIFICATION] Starting meter abnormality alert for meter ${meterSerial}`);
            
            // Create notification first
            const notification = await NotificationDB.createNotification({
                consumerId: 1, // System consumer
                type: 'SYSTEM_ALERT',
                title: `Meter Abnormality Alert - ${dtrName}`,
                message: `Meter ${meterSerial} at ${dtrName} (${feederName}) has detected abnormality: ${abnormalityType}. Requires investigation.`,
                priority: 'HIGH',
                channels: ['PUSH', 'EMAIL', 'SMS']
            });

            // Send email and SMS alerts using EmailService (which handles both)
            try {
                await EmailService.sendMeterAbnormalityAlert(meterSerial, feederName, dtrName, abnormalityType, powerData);
                console.log(`📧 [NOTIFICATION] Meter abnormality alert sent successfully for meter ${meterSerial}`);
            } catch (alertError) {
                console.error(`❌ [NOTIFICATION] Failed to send meter abnormality alert:`, alertError);
            }

            return notification;
        } catch (error) {
            console.error('NotificationService.sendMeterAbnormalityAlert:', error);
            throw error;
        }
    }
}

export default NotificationService;
