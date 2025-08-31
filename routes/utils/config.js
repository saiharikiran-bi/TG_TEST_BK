import dotenv from 'dotenv';

dotenv.config();

export const config = {
    SOCKET_PORT: process.env.SOCKET_PORT,
    PORT: process.env.PORT,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
}   