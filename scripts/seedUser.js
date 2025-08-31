import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Create default test user for sub-app authentication
export const createTestUser = async () => {
    try {
        const testEmail = 'test@adminmodule.com';
        const existingUser = await prisma.users.findUnique({
            where: { email: testEmail }
        });
        
        if (!existingUser) {
            // Hash the password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash('test123', saltRounds);
            
            await prisma.users.create({
                data: {
                    username: 'testuser',
                    email: testEmail,
                    password: hashedPassword,
                    firstName: 'Test',
                    lastName: 'User',
                    isActive: true,
                    accessLevel: 'NORMAL',
                    updatedAt: new Date()
                }
            });
            
            console.log('✅ Test user created successfully');
            console.log('👤 Username: testuser');
            console.log('📧 Email: test@adminmodule.com');
            console.log('🔑 Password: test123');
            console.log('💡 You can login with either username or email');
            console.log('⚠️  Please change the default password after first login');
        } else {
            console.log('ℹ️  Test user already exists');
        }
    } catch (error) {
        console.error('❌ Error creating test user:', error.message);
    } finally {
        await prisma.$disconnect();
    }
};

// Run immediately if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    createTestUser();
} 