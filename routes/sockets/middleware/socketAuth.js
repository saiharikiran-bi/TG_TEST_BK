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
    }
}

/**
 * Handle socket disconnection
 * @param {Object} socket - Socket instance
 */
export function handleDisconnect(socket) {
    
    if (socket.userId) {
    }
}

export default {
    socketAuthMiddleware,
    joinUserRoom,
    handleDisconnect
}; 