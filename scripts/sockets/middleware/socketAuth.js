import { getIO } from '../index.js';

/**
 * Socket authentication middleware
 * @param {Object} socket - Socket instance
 * @param {Function} next - Next function
 */
export function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    
    if (!token) {
        return next(new Error('Authentication token required'));
    }
    
    try {
        // Here you would verify the token
        // For now, we'll just store the token
        socket.token = token;
        socket.userId = socket.handshake.auth.userId;
        
        console.log(`🔐 Socket authenticated: ${socket.id} for user: ${socket.userId}`);
        next();
    } catch (error) {
        console.error(`❌ Socket authentication failed: ${error.message}`);
        next(new Error('Authentication failed'));
    }
}

/**
 * Join user to their personal room after authentication
 * @param {Object} socket - Socket instance
 */
export function joinUserRoom(socket) {
    if (socket.userId) {
        socket.join(`user_${socket.userId}`);
        console.log(`👤 User ${socket.userId} joined room: user_${socket.userId}`);
    }
}

/**
 * Handle socket disconnection
 * @param {Object} socket - Socket instance
 */
export function handleDisconnect(socket) {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    
    if (socket.userId) {
        console.log(`👤 User ${socket.userId} disconnected`);
    }
}

export default {
    socketAuthMiddleware,
    joinUserRoom,
    handleDisconnect
}; 