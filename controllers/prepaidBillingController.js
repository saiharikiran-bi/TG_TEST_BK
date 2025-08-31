import PrepaidBillingDB from '../models/PrepaidBillingDB.js';

export const getPrepaidBillingStats = async (req, res) => {
    try {
        const stats = await PrepaidBillingDB.getPrepaidBillingStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('getPrepaidBillingStats: Error fetching prepaid billing stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch prepaid billing statistics',
            error: error.message
        });
    }
};

export const getPrepaidBillingTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const filters = {
            status: req.query.status,
            consumerNumber: req.query.consumerNumber,
            accountNumber: req.query.accountNumber
        };

        const billingData = await PrepaidBillingDB.getPrepaidBillingTable(page, limit, filters);
        
        res.json({
            success: true,
            data: billingData
        });
    } catch (error) {
        console.error('❌ getPrepaidBillingTable: Error fetching prepaid billing table:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch prepaid billing table',
            error: error.message
        });
    }
}; 