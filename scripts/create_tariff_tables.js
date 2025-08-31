import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function createTariffTables() {
    try {
        console.log('🗄️ Starting to create tariff tables...');
        
        // Read the SQL file
        const sqlFilePath = path.join(__dirname, 'add_tariff_tables.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
        
        console.log('📖 SQL file read successfully');
        
        // Split SQL into individual statements
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`🔧 Found ${statements.length} SQL statements to execute`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
                console.log(`   ${statement.substring(0, 100)}...`);
                
                await prisma.$executeRawUnsafe(statement);
                console.log(`✅ Statement ${i + 1} executed successfully`);
            }
        }
        
        console.log('🎉 All tariff tables created successfully!');
        
        // Verify tables were created
        console.log('🔍 Verifying tables...');
        
        // Check if refresh_tokens table exists
        const refreshTokensExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'refresh_tokens'
            );
        `;
        
        // Check if tariff table exists
        const tariffExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tariff'
            );
        `;
        
        // Check if tariff_slabs table exists
        const tariffSlabsExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tariff_slabs'
            );
        `;
        
        console.log('📊 Table verification results:');
        console.log(`   - refresh_tokens table: ${refreshTokensExists[0].exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        console.log(`   - tariff table: ${tariffExists[0].exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        console.log(`   - tariff_slabs table: ${tariffSlabsExists[0].exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        
        if (refreshTokensExists[0].exists && tariffExists[0].exists && tariffSlabsExists[0].exists) {
            console.log('🎯 All tables verified successfully!');
            
            // Show table structure
            console.log('\n📋 Table structure:');
            
            const refreshTokensColumns = await prisma.$queryRaw`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'refresh_tokens' 
                ORDER BY ordinal_position;
            `;
            
            console.log('\n📊 REFRESH_TOKENS table columns:');
            refreshTokensColumns.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
            });
            
            const tariffColumns = await prisma.$queryRaw`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'tariff' 
                ORDER BY ordinal_position;
            `;
            
            console.log('\n📊 TARIFF table columns:');
            tariffColumns.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
            });
            
            const tariffSlabsColumns = await prisma.$queryRaw`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'tariff_slabs' 
                ORDER BY ordinal_position;
            `;
            
            console.log('\n📊 TARIFF_SLABS table columns:');
            tariffSlabsColumns.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
            });
            
        } else {
            console.log('❌ Some tables were not created properly');
        }
        
    } catch (error) {
        console.error('❌ Error creating tariff tables:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
createTariffTables()
    .then(() => {
        console.log('✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
