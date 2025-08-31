import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateNotifications() {
    try {
        console.log('🔄 Starting notifications migration...');

        // Check if we need to add the readAt column
        const tableInfo = await prisma.$queryRaw`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'readAt'
        `;

        if (tableInfo.length === 0) {
            console.log('📝 Adding readAt column to notifications table...');
            await prisma.$executeRaw`ALTER TABLE notifications ADD COLUMN "readAt" TIMESTAMP`;
            console.log('✅ readAt column added successfully');
        } else {
            console.log('ℹ️ readAt column already exists');
        }

        // Update existing notifications to have proper status
        console.log('📝 Updating existing notifications...');
        const updateResult = await prisma.notifications.updateMany({
            where: {
                status: null
            },
            data: {
                status: 'PENDING'
            }
        });

        if (updateResult.count > 0) {
            console.log(`✅ Updated ${updateResult.count} notifications with default status`);
        } else {
            console.log('ℹ️ No notifications needed status updates');
        }

        // Create indexes for better performance
        console.log('📝 Creating database indexes...');
        try {
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications("status")`;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_notifications_consumer_id ON notifications("consumerId")`;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications("createdAt")`;
            console.log('✅ Database indexes created successfully');
        } catch (error) {
            console.log('ℹ️ Indexes may already exist:', error.message);
        }

        console.log('✅ Notifications migration completed successfully');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateNotifications()
        .then(() => {
            console.log('🎉 Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

export default migrateNotifications;
