import DashboardDB from '../models/DashboardDB.js';
import { getDateTime, getDateInYMDFormat, getDateInMYFormat, fillMissingDatesDyno } from '../utils/utils.js';

export const getMainWidgets = async (req, res) => {
    try {
        const widgetsData = await DashboardDB.getMainWidgets();
        res.json({
            success: true,
            data: widgetsData,
            message: 'Dashboard widgets retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching dashboard widgets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard widgets',
            error: error.message
        });
    }
};

export const getMainGraphAnalytics = async (req, res) => {
    try {
        const consumptionOnDaily = await DashboardDB.graphDashboardAnalytics('daily');
        const consumptionOnMonthly = await DashboardDB.graphDashboardAnalytics('monthly');
        
        const { dailyxAxisData, dailysums } = consumptionOnDaily.reduce(
            (acc, item) => {
                acc.dailyxAxisData.push(item.consumption_date);
                acc.dailysums.push((item.total_consumption || 0).toFixed(2));
                return acc;
            },
            { dailyxAxisData: [], dailysums: [] }
        );
        
        const daily = fillMissingDatesDyno(
            dailyxAxisData,
            dailysums,
            'DD MMM, YYYY',
            'day'
        );
        
        const { monthlyxAxisData, monthlysums } = consumptionOnMonthly.reduce(
            (acc, item) => {
                acc.monthlyxAxisData.push(
                    getDateInMYFormat(item.consumption_date)
                );
                acc.monthlysums.push((item.total_consumption || 0).toFixed(2));
                return acc;
            },
            { monthlyxAxisData: [], monthlysums: [] }
        );
        
        const monthly = fillMissingDatesDyno(
            monthlyxAxisData,
            monthlysums,
            'DD MMM, YYYY',
            'month'
        );

        const dailyData = {
            xAxisData: daily.dates,
            sums: daily.values,
        };

        const monthlyData = {
            xAxisData: monthly.dates,
            sums: monthly.values,
        };
        
        res.status(200).json({
            status: 'success',
            data: {
                dailyData,
                monthlyData,
            },
        });
    } catch (error) {
        console.error('Error fetching graph analytics:', {
            error: error.message,
            stack: error.stack,
            timestamp: getDateTime(),
        });

        res.status(500).json({
            status: 'error',
            message: 'An error occurred while fetching graph analytics',
            errorId: error.code || 'INTERNAL_SERVER_ERROR',
        });
    }
}; 