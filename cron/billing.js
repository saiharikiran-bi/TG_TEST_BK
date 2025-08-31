import BillingDB from '../models/BillingDB.js';

export async function generateMonthlyBillsTask(prisma) {
    try {
        console.log('🕐 [CRON-BILLING] Starting scheduled bill generation...');
        console.log('⏰ [CRON-BILLING] Timestamp:', new Date().toISOString());
        
        const result = await BillingDB.generateMonthlyBills();
        
        console.log('✅ [CRON-BILLING] Bill generation completed successfully');
        console.log(`📊 [CRON-BILLING] ${result.message}`);
        
        if (result.bills && result.bills.length > 0) {
            const totalAmount = result.bills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0);
            console.log(`💰 [CRON-BILLING] Total amount generated: ₹${totalAmount.toFixed(2)}`);
            
            // Log bill generation (no notifications - only TGNPDCL alerts are supported)
            for (const bill of result.bills) {
                console.log(`📋 [CRON-BILLING] Bill generated for consumer ${bill.consumerId}: ₹${bill.totalAmount}`);
            }
        }
        
        return result;
    } catch (error) {
        console.error('❌ [CRON-BILLING] Bill generation failed:', error);
        throw error;
    }
}

export default generateMonthlyBillsTask; 