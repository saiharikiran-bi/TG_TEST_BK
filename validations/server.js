import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import meters from './routes/meters.js';
import consumers from './routes/consumers.js';
import assets from './routes/assets.js';
import users from './routes/users.js';
import roles from './routes/roles.js';
import billing from './routes/billing.js';
import dashboard from './routes/dashboard.js';
import tickets from './routes/tickets.js';
import dtrs from './routes/dtrs.js';
import notifications from './routes/notifications.js';
import apiRoutes from './routes/apiRoutes.js';
import subAppAuthRoutes from './routes/subAppAuth.js';
import { initializeCronJobs } from './cron/jobs.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const prisma = new PrismaClient();

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:1700',
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:4221',
            'https://www.test35.bestinfra.app'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.CORS_ORIGIN === '*') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(cookieParser()); // Add cookie parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.use('/api', apiRoutes);

// Notification routes
app.use('/api/notifications', notifications);

// Sub-app authentication routes
app.use('/api/sub-app/auth', subAppAuthRoutes);

app.get('/api/health', (req, res) => res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Application Backend API is running'
}));


// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        error: `Cannot ${req.method} ${req.originalUrl}`
    });
});

async function startServer() {
    try {
        await prisma.$connect();
        console.log('Connected to database successfully');
        
        await initializeCronJobs();
        console.log('Cron jobs initialized successfully');
        
        app.listen(PORT, () => {
            console.log(`Backend running on port ${PORT}`);
            console.log(`API Documentation: http://localhost:${PORT}/api/health`);
        });
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down server...');
    await prisma.$disconnect();
    process.exit(0);
});

startServer();
