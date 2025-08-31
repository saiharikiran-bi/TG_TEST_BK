import TicketDB from '../models/TicketDB.js';
import { getDateTime } from '../utils/utils.js';

export const getTicketStats = async (req, res) => {
    try {
        // Get user's location from req.user (populated by middleware)
        const userLocationId = req.user?.locationId;
        
        // Pass locationId to TicketDB method (null = all data, locationId = filtered data)
        const stats = await TicketDB.getTicketStats(userLocationId);
        
        // Only send relevant stats fields
        res.json({
            success: true,
            data: {
                total: stats.total,
                open: stats.open,
                inProgress: stats.inProgress,
                resolved: stats.resolved,
                closed: stats.closed
            },
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error(' getTicketStats: Error fetching ticket stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket statistics',
            error: error.message
        });
    }
};

export const getTicketsTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const filters = {
            status: req.query.status,
            type: req.query.type,
            category: req.query.category,
            priority: req.query.priority,
            consumerNumber: req.query.consumerNumber,
            ticketNumber: req.query.ticketNumber
        };

        // Get user's location from req.user (populated by middleware)
        const userLocationId = req.user?.locationId;

        const ticketsData = await TicketDB.getTicketsTable(page, limit, filters, userLocationId, search);
        // Always return consumer name (from t.consumer.name or t.consumer.consumerNumber)
        const formatted = ticketsData.data.map((t, idx) => ({
            sNo: (page - 1) * limit + idx + 1,
            ticketNumber: t.ticketNumber,
            dtrNumber: t.dtrNumber,
            subject: t.subject,
            // Show first meter serial number or count of meters
            meterSerialNo: t.connectedMeters.length > 0 ? t.connectedMeters[0].serialNumber : `${t.meterCount} meters`,
            category: t.category || 'NA',
            priority: t.priority,
            status: t.status,
            assignedTo: t.assignedTo || 'NA',
            createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'NA',
        }));
        res.json({
            success: true,
            data: formatted,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(ticketsData.total / limit),
                totalCount: ticketsData.total,
                limit: limit,
                hasNextPage: page < Math.ceil(ticketsData.total / limit),
                hasPrevPage: page > 1
            },
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error(' getTicketsTable: Error fetching tickets table:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tickets table',
            error: error.message
        });
    }
};

export const getTicketTrends = async (req, res) => {
    try {
        // Get user's location from req.user (populated by middleware)
        const userLocationId = req.user?.locationId;
        
        const trendsData = await TicketDB.getLastTwelveMonthsTrends(userLocationId);
        // Only send xAxisData and seriesData as before
        const formattedData = trendsData.map(row => ({
            month: row.month,
            open_count: parseInt(row.open_count),
            in_progress_count: parseInt(row.in_progress_count),
            resolved_count: parseInt(row.resolved_count),
            closed_count: parseInt(row.closed_count)
        }));
        const result = {
            xAxisData: formattedData.map((row) => row.month),
            seriesData: [
                {
                    name: 'Open',
                    data: formattedData.map((row) => row.open_count),
                },
                {
                    name: 'In Progress',
                    data: formattedData.map((row) => row.in_progress_count),
                },
                {
                    name: 'Resolved',
                    data: formattedData.map((row) => row.resolved_count),
                },
                {
                    name: 'Closed',
                    data: formattedData.map((row) => row.closed_count),
                },
            ],
        };
        res.status(200).json({
            success: true,
            data: result,
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error(' getTicketTrends: Error fetching ticket trends:', {
            error: error.message,
            stack: error.stack,
            timestamp: getDateTime(),
        });
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            errorId: error.code || 'INTERNAL_SERVER_ERROR',
        });
    }
};

export const getTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        const numericId = Number(id);
        if (!Number.isFinite(numericId) || numericId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid ticket id' });
        }
        
        const ticket = await TicketDB.getTicketById(numericId);
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        res.json({
            success: true,
            data: ticket
        });
    } catch (error) {
        console.error(' getTicketById: Error fetching ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket',
            error: error.message
        });
    }
};

export const getTicketsByDtrId = async (req, res) => {
    try {
        const { dtrId } = req.params;
        const tickets = await TicketDB.getTicketsByDtrId(dtrId);
        
        res.json({
            success: true,
            data: tickets
        });
    } catch (error) {
        console.error(' getTicketsByDtrId: Error fetching DTR tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DTR tickets',
            error: error.message
        });
    }
};



export const createTicket = async (req, res) => {
    try {
        // Use validated data from middleware
        const ticketData = req.validatedData;
        
        // Get user's ID from req.user (populated by middleware)
        const raisedById = req.user?.userId || req.user?.id;
        
        if (!raisedById) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        // Add the raisedById to the ticket data
        const ticketDataWithUser = {
            ...ticketData,
            raisedById
        };

        const newTicket = await TicketDB.createTicket(ticketDataWithUser);
        
        res.status(201).json({
            success: true,
            message: 'Ticket created successfully',
            data: newTicket
        });
        
    } catch (error) {
        console.error('createTicket: Error creating ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create ticket',
            error: error.message
        });
    }
};

export const getDtrDetails = async (req, res) => {
    try {
        const { dtrNumber } = req.params;
        
        if (!dtrNumber) {
            return res.status(400).json({
                success: false,
                message: 'DTR Number is required'
            });
        }

        const dtrDetails = await TicketDB.getDtrDetails(dtrNumber);
        
        if (!dtrDetails) {
            return res.status(404).json({
                success: false,
                message: 'DTR not found'
            });
        }

        res.json({
            success: true,
            data: dtrDetails
        });
        
    } catch (error) {
        console.error('getDtrDetails: Error fetching DTR details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DTR details',
            error: error.message
        });
    }
}; 

