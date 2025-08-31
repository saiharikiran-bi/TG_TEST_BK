import { checkMeterAbnormalities } from './cron/meterAbnormalityCheck.js';

async function testMeterCheck() {
    try {
        console.log('🧪 Testing meter abnormality check...');
        const result = await checkMeterAbnormalities();
        console.log('✅ Test successful:', result);
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testMeterCheck();
