import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class NotificationDB {
    // Create a new notification (used by TGNPDCL alerts)
    static async createNotification(notificationData) {
        try {
            const notification = await prisma.notifications.create({
                data: {
                    consumerId: notificationData.consumerId || 1,
                    type: notificationData.type,
                    title: notificationData.title,
                    message: notificationData.message,
                    priority: notificationData.priority || 'MEDIUM',
                    channels: notificationData.channels || ['PUSH'],
                    status: 'PENDING'
                }
            });

            console.log(`✅ [NOTIFICATION-DB] Notification created: ${notification.id}`);
            return notification;
        } catch (error) {
            console.error('NotificationDB.createNotification: Database error:', error);
            throw error;
        }
    }
}

export default NotificationDB;
