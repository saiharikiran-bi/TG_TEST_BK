import { getIO, emitToAll, emitToRoom, joinRoom, leaveRoom } from '../index.js';

// Store online users
const onlineUsers = new Map();

// Handle user authentication
export async function handleUserAuth(socket, userData) {
    try {
        const { userId, username, role } = userData;
        
        // Store user info
        onlineUsers.set(userId, {
            socketId: socket.id,
            username,
            role,
            connectedAt: new Date()
        });

        // Join user-specific room
        joinRoom(socket, `user_${userId}`);
        
        // Join role-based room
        if (role) {
            joinRoom(socket, `role_${role}`);
        }

        console.log(`🔌 [SOCKET] User ${username} (${userId}) connected`);
        
        // Emit user online status
        emitToAll('user_online', { userId, username, role });
        
    } catch (error) {
        console.error('Socket authentication error:', error);
    }
}

// Send notification to specific user
export async function sendNotification(socket, notificationData) {
    try {
        const { userId, type, title, message, priority = 'MEDIUM' } = notificationData;
        
        if (!userId || !type || !title || !message) {
            throw new Error('Missing required notification fields');
        }

        const notification = {
            id: Date.now(),
            type,
            title,
            message,
            priority,
            timestamp: new Date(),
            read: false
        };

        // Emit to specific user room
        emitToRoom(`user_${userId}`, 'notification', notification);
        
        console.log(`📢 [SOCKET] Notification sent to user ${userId}: ${title}`);
        
        return notification;
    } catch (error) {
        console.error('Socket notification error:', error);
        throw error;
    }
}

// Handle ticket updates
export async function handleTicketUpdate(socket, ticketData) {
    try {
        const { ticketId, status, assignedTo, updatedBy } = ticketData;
        
        // Emit ticket update to relevant users
        if (assignedTo) {
            emitToRoom(`user_${assignedTo}`, 'ticket_updated', {
                ticketId,
                status,
                updatedBy,
                timestamp: new Date()
            });
        }
        
        // Emit to admin/manager rooms if status changed
        if (status === 'ESCALATED' || status === 'URGENT') {
            emitToRoom('role_admin', 'ticket_escalated', {
                ticketId,
                status,
                assignedTo,
                updatedBy,
                timestamp: new Date()
            });
        }
        
        console.log(`🎫 [SOCKET] Ticket ${ticketId} update broadcasted`);
        
    } catch (error) {
        console.error('Socket ticket update error:', error);
    }
}

// Handle meter reading updates
export async function handleMeterReading(socket, meterData) {
    try {
        const { meterSerial, dtrName, feederName, readings } = meterData;
        
        // Emit meter reading to relevant rooms
        emitToRoom(`dtr_${dtrName}`, 'meter_reading', {
            meterSerial,
            dtrName,
            feederName,
            readings,
            timestamp: new Date()
        });
        
        console.log(`📊 [SOCKET] Meter reading broadcasted for ${meterSerial}`);
        
    } catch (error) {
        console.error('Socket meter reading error:', error);
    }
}

// Send announcement to all users
export async function sendAnnouncement(socket, announcementData) {
    try {
        const { title, message, priority = 'MEDIUM', targetRoles = [] } = announcementData;
        
        const announcement = {
            id: Date.now(),
            title,
            message,
            priority,
            timestamp: new Date(),
            targetRoles
        };

        if (targetRoles.length > 0) {
            // Send to specific role rooms
            for (const role of targetRoles) {
                emitToRoom(`role_${role}`, 'announcement', announcement);
            }
        } else {
            // Send to all users
            emitToAll('announcement', announcement);
        }
        
        console.log(`📢 [SOCKET] Announcement sent: ${title}`);
        
        return announcement;
    } catch (error) {
        console.error('Socket announcement error:', error);
        throw error;
    }
}

// Handle user logout
export async function handleUserLogout(socket, userId) {
    try {
        if (userId) {
            const userInfo = onlineUsers.get(userId);
            if (userInfo) {
                // Remove from online users
                onlineUsers.delete(userId);
                
                // Leave rooms
                leaveRoom(socket, `user_${userId}`);
                if (userInfo.role) {
                    leaveRoom(socket, `role_${userInfo.role}`);
                }
                
                // Emit user offline status
                emitToAll('user_offline', { userId, username: userInfo.username });
                
                console.log(`🔌 [SOCKET] User ${userInfo.username} (${userId}) disconnected`);
            }
        }
    } catch (error) {
        console.error('Socket logout error:', error);
    }
}

// Get user's socket ID
export function getUserSocketId(userId) {
    const userInfo = onlineUsers.get(userId);
    return userInfo ? userInfo.socketId : null;
}

// Check if user is online
export function isUserOnline(userId) {
    return onlineUsers.has(userId);
}

export default {
    handleUserAuth,
    sendNotification,
    handleTicketUpdate,
    handleMeterReading,
    sendAnnouncement,
    handleUserLogout,
    getUserSocketId,
    isUserOnline
}; 