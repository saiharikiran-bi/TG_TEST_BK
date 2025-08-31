import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const createTransporter = async () => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: false, 
            },
        });

        await transporter.verify();
        console.log('✅ Email transporter configured successfully');
        return transporter;
    } catch (error) {
        console.error('❌ Email transporter configuration failed:', error);
        throw error;
    }
};

let transporter = null;

export const getTransporter = async () => {
    if (!transporter) {
        transporter = await createTransporter();
    }
    return transporter;
};

export const resetTransporter = () => {
    transporter = null;
};

export default {
    getTransporter,
    resetTransporter
};
