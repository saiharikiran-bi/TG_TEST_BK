import dotenv from 'dotenv';

dotenv.config();

export const emailConfig = {
    // SMTP Configuration
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },

    // Email Configuration
    email: {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        appName: process.env.APP_NAME || 'Admin Module',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:1700',
    },

    // Recipient Configuration
    recipients: {
        admin: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [
            'admin@example.com'
        ],
        support: process.env.SUPPORT_EMAILS ? process.env.SUPPORT_EMAILS.split(',') : [
            'support@example.com'
        ],
    },

    // SMS Configuration (if using MSG91 or similar)
    sms: {
        authToken: process.env.MSG_AUTH_TOKEN,
        senderId: process.env.MSG_SENDER_ID,
        templateId: process.env.MSG_TEMPLATE_ID,
        dltTeId: process.env.DLT_TE_ID,
    },

    // Rate Limiting Configuration
    rateLimit: {
        minIntervalMs: 15 * 60 * 1000, // 15 minutes
        maxEmailsPerHour: {
            LOW: 10,
            MEDIUM: 20,
            HIGH: 30,
            URGENT: 50
        }
    },

    // Notification Levels Configuration
    notificationLevels: {
        LOW: {
            priority: 'low',
            subjectPrefix: 'ℹ️',
            delayMinutes: 60,
            maxEmailsPerHour: 10
        },
        MEDIUM: {
            priority: 'normal',
            subjectPrefix: '📢',
            delayMinutes: 30,
            maxEmailsPerHour: 20
        },
        HIGH: {
            priority: 'high',
            subjectPrefix: '⚠️',
            delayMinutes: 15,
            maxEmailsPerHour: 30
        },
        URGENT: {
            priority: 'high',
            subjectPrefix: '🚨',
            delayMinutes: 5,
            maxEmailsPerHour: 50
        }
    }
};

export default emailConfig;
