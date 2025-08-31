# Socket.IO Utilities

This directory contains socket.io utilities and handlers for real-time communication in the application.

## Structure

```
sockets/
├── index.js              # Main socket exports
├── handlers/
│   └── socketHandlers.js # Socket event handlers
├── middleware/           # Socket middleware (future use)
└── README.md            # This file
```

## Usage

### Basic Socket Operations

```javascript
import { getIO, emitToAll, emitToRoom } from './sockets/index.js';

// Get the io instance
const io = getIO();

// Emit to all connected clients
emitToAll('event_name', { data: 'value' });

// Emit to specific room
emitToRoom('room_name', 'event_name', { data: 'value' });
```

### User Management

```javascript
import { handleUserAuth, sendNotification, isUserOnline } from './sockets/handlers/socketHandlers.js';

// Authenticate user and join room
handleUserAuth(socketId, userId);

// Send notification to specific user
sendNotification(userId, {
    type: 'info',
    message: 'New ticket assigned',
    data: { ticketId: '123' }
});

// Check if user is online
const online = isUserOnline(userId);
```

### Room Management

```javascript
import { joinRoom, leaveRoom } from './sockets/index.js';

// Join a socket to a room
joinRoom(socketId, 'room_name');

// Leave a socket from a room
leaveRoom(socketId, 'room_name');
```

### Ticket Updates

```javascript
import { handleTicketUpdate } from './sockets/handlers/socketHandlers.js';

// Send ticket update to all users watching the ticket
handleTicketUpdate(ticketId, {
    status: 'in_progress',
    assignedTo: 'user123',
    message: 'Ticket updated'
});
```

### Meter Readings

```javascript
import { handleMeterReading } from './sockets/handlers/socketHandlers.js';

// Send meter reading update
handleMeterReading(meterId, {
    reading: 1234.56,
    timestamp: new Date(),
    unit: 'kWh'
});
```

### System Announcements

```javascript
import { sendAnnouncement } from './sockets/handlers/socketHandlers.js';

// Send system-wide announcement
sendAnnouncement({
    type: 'maintenance',
    message: 'System maintenance scheduled',
    scheduledTime: '2024-01-15T10:00:00Z'
});
```

## Available Functions

### Core Socket Functions
- `getIO()` - Get the io instance
- `getServer()` - Get the server instance
- `emitToAll(event, data)` - Emit to all connected clients
- `emitToRoom(room, event, data)` - Emit to specific room
- `joinRoom(socketId, room)` - Join socket to room
- `leaveRoom(socketId, room)` - Leave socket from room
- `getConnectedSockets()` - Get all connected socket IDs
- `getSocketCount()` - Get number of connected sockets

### Handler Functions
- `handleUserAuth(socketId, userId)` - Authenticate user and join room
- `sendNotification(userId, notification)` - Send notification to user
- `handleTicketUpdate(ticketId, update)` - Handle ticket updates
- `handleMeterReading(meterId, reading)` - Handle meter reading updates
- `sendAnnouncement(announcement)` - Send system announcement
- `handleUserLogout(socketId, userId)` - Handle user logout
- `getUserSocketId(userId)` - Get user's socket ID
- `isUserOnline(userId)` - Check if user is online

## Room Naming Convention

- User rooms: `user_${userId}`
- Ticket rooms: `ticket_${ticketId}`
- Meter rooms: `meter_${meterId}`
- System rooms: `system_${roomName}`

## Event Naming Convention

- User events: `user_${eventName}`
- Ticket events: `ticket_${eventName}`
- Meter events: `meter_${eventName}`
- System events: `system_${eventName}`
- General events: `notification`, `announcement`, `welcome` 