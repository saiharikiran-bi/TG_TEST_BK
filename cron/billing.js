import BillingDB from '../models/BillingDB.js';

export async function generateMonthlyBillsTask(prisma) {
    try {
        
        const result = await BillingDB.generateMonthlyBills();
        
        
        if (result.bills && result.bills.length > 0) {
            const totalAmount = result.bills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0);
            
            // Log bill generation (no notifications - only TGNPDCL alerts are supported)
            for (const bill of result.bills) {
            }
        }
        
        return result;
    } catch (error) {
        console.error('❌ [CRON-BILLING] Bill generation failed:', error);
        throw error;
    }
}

export default generateMonthlyBillsTask; 