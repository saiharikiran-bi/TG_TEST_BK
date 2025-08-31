import { PrismaClient } from '@prisma/client';
import { getDateInYMDFormat, generateTicketNumber } from '../utils/utils.js';

const prisma = new PrismaClient();

class TicketDB {
    static async getTicketStats(locationId = null) {
        try {            
            const whereClause = {};
            
            // If locationId is provided, filter tickets by DTR location
            if (locationId) {
                whereClause.dtrs = {
                    locationId: locationId
                };
            }
            
            const tickets = await prisma.tickets.findMany({
                where: whereClause,
                select: {
                    status: true
                }
            });

            const totalTickets = tickets.length;
            const openCount = tickets.filter(ticket => ticket.status === 'OPEN').length;
            const inProgressCount = tickets.filter(ticket => ticket.status === 'IN_PROGRESS').length;
            const resolvedCount = tickets.filter(ticket => ticket.status === 'RESOLVED').length;
            const closedCount = tickets.filter(ticket => ticket.status === 'CLOSED').length;

            const stats = {
                total: totalTickets,
                open: openCount,
                inProgress: inProgressCount,
                resolved: resolvedCount,
                closed: closedCount
            };
            
            return stats;
        } catch (error) {
            console.error(' TicketDB.getTicketStats: Database error:', error);
            throw error;
        }
    }

    static async getTicketsTable(page = 1, limit = 10, filters = {}, locationId = null) {
        try {
            
            const skip = (page - 1) * limit;
            
            const whereClause = {};

            if (filters.status) {
                whereClause.status = filters.status;
            }

            if (filters.type) {
                whereClause.type = filters.type;
            }

            if (filters.category) {
                whereClause.category = filters.category;
            }

            if (filters.priority) {
                whereClause.priority = filters.priority;
            }

            if (filters.dtrNumber) {
                whereClause.dtrs = {
                    dtrNumber: {
                        contains: filters.dtrNumber,
                        mode: 'insensitive'
                    }
                };
            }

            if (filters.ticketNumber) {
                whereClause.ticketNumber = {
                    contains: filters.ticketNumber,
                    mode: 'insensitive'
                };
            }
            
            // If locationId is provided, filter tickets by DTR location
            if (locationId) {
                // Handle case where dtrs filter already exists
                if (whereClause.dtrs) {
                    whereClause.dtrs = {
                        AND: [
                            whereClause.dtrs,
                            { locationId: locationId }
                        ]
                    };
                } else {
                    whereClause.dtrs = {
                        locationId: locationId
                    };
                }
            }

            const totalCount = await prisma.tickets.count({
                where: whereClause
            });

            const tickets = await prisma.tickets.findMany({
                where: whereClause,
                include: {
                    dtrs: {
                        select: {
                            dtrNumber: true,
                            serialNumber: true,
                            locations: {
                                select: {
                                    name: true,
                                    address: true
                                }
                            },
                            meters: {
                                select: {
                                    meterNumber: true,
                                    serialNumber: true,
                                    manufacturer: true,
                                    model: true,
                                    type: true,
                                    status: true
                                }
                            }
                        }
                    },
                    users_tickets_raisedByIdTousers: {
                        select: {
                            username: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    users_tickets_assignedToIdTousers: {
                        select: {
                            username: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            });

            const ticketData = tickets.map(ticket => ({
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
                description: ticket.description,
                type: ticket.type,
                category: ticket.category,
                priority: ticket.priority,
                status: ticket.status,
                resolution: ticket.resolution,
                dtrNumber: ticket.dtrs?.dtrNumber || 'NA',
                dtrSerialNumber: ticket.dtrs?.serialNumber || 'NA',
                locationName: ticket.dtrs?.locations?.name || 'NA',
                locationAddress: ticket.dtrs?.locations?.address || 'NA',
                // Get connected meters information
                connectedMeters: ticket.dtrs?.meters?.map(meter => ({
                    meterNumber: meter.meterNumber,
                    serialNumber: meter.serialNumber,
                    manufacturer: meter.manufacturer,
                    model: meter.model,
                    type: meter.type,
                    status: meter.status
                })) || [],
                meterCount: ticket.dtrs?.meters?.length || 0,
                raisedBy: ticket.users_tickets_raisedByIdTousers ? `${ticket.users_tickets_raisedByIdTousers.firstName} ${ticket.users_tickets_raisedByIdTousers.lastName}` : null,
                assignedTo: ticket.users_tickets_assignedToIdTousers ? `${ticket.users_tickets_assignedToIdTousers.firstName} ${ticket.users_tickets_assignedToIdTousers.lastName}` : null,
                createdAt: ticket.createdAt,
                updatedAt: ticket.updatedAt
            }));

            const totalPages = Math.ceil(totalCount / limit);

            const result = {
                data: ticketData,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
            
            return result;
        } catch (error) {
            console.error(' TicketDB.getTicketsTable: Database error:', error);
            throw error;
        }
    }

    static async getLastTwelveMonthsTrends(locationId = null) {
        try {
            const today = new Date();
            const months = [];
            for (let i = 0; i < 12; i++) {
                const date = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
                months.push({
                    month: getDateInYMDFormat(date).slice(0, 7)
                });
            }

            const startMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
            const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

            const whereClause = {
                createdAt: {
                    gte: startMonth,
                    lt: endMonth
                }
            };
            
            // If locationId is provided, filter tickets by DTR location
            if (locationId) {
                whereClause.dtrs = {
                    locationId: locationId
                };
            }

            const tickets = await prisma.tickets.findMany({
                where: whereClause,
                select: {
                    status: true,
                    createdAt: true
                }
            });

            const trendsData = months.map(monthData => {
                const monthTickets = tickets.filter(ticket => {
                    const ticketMonth = getDateInYMDFormat(ticket.createdAt).slice(0, 7);
                    return ticketMonth === monthData.month;
                });

                return {
                    month: monthData.month,
                    open_count: monthTickets.filter(t => t.status === 'OPEN').length,
                    in_progress_count: monthTickets.filter(t => t.status === 'IN_PROGRESS').length,
                    resolved_count: monthTickets.filter(t => t.status === 'RESOLVED').length,
                    closed_count: monthTickets.filter(t => t.status === 'CLOSED').length
                };
            });
            
            return trendsData;
        } catch (error) {
            console.error(' TicketDB.getLastTwelveMonthsTrends: Database error:', error);
            throw error;
        }
    }

    static async getTicketById(ticketId) {
        try {
            const ticket = await prisma.tickets.findUnique({
                where: { id: ticketId },
                include: {
                    dtrs: {
                        include: {
                            locations: true,
                            meters: {
                                include: {
                                    locations: true
                                }
                            }
                        }
                    },
                    users_tickets_raisedByIdTousers: {
                        select: {
                            username: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    users_tickets_assignedToIdTousers: {
                        select: {
                            username: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });

            if (!ticket) {
                return null;
            }

            // Map the data similar to getTicketsTable
            const raisedBy = ticket.users_tickets_raisedByIdTousers;
            const assignedTo = ticket.users_tickets_assignedToIdTousers;
            const dtr = ticket.dtrs;
            const location = dtr?.locations?.name ?? dtr?.locations?.address;
            const firstMeter = Array.isArray(dtr?.meters) && dtr.meters.length > 0 ? dtr.meters[0] : undefined;
            const meterNumber = firstMeter?.meterNumber ?? firstMeter?.serialNumber;
            const connectionType = firstMeter?.type ?? dtr?.type;

            const mappedTicket = {
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
                description: ticket.description,
                type: ticket.type,
                category: ticket.category,
                priority: ticket.priority,
                status: ticket.status,
                resolution: ticket.resolution,
                dtrNumber: dtr?.dtrNumber || 'NA',
                dtrSerialNumber: dtr?.serialNumber || 'NA',
                locationName: dtr?.locations?.name || 'NA',
                locationAddress: dtr?.locations?.address || 'NA',
                // Get connected meters information
                connectedMeters: dtr?.meters?.map(meter => ({
                    meterNumber: meter.meterNumber,
                    serialNumber: meter.serialNumber,
                    manufacturer: meter.manufacturer,
                    model: meter.model,
                    type: meter.type,
                    status: meter.status
                })) || [],
                meterCount: dtr?.meters?.length || 0,
                raisedBy: raisedBy ? `${raisedBy.firstName} ${raisedBy.lastName}` : null,
                assignedTo: assignedTo ? `${assignedTo.firstName} ${assignedTo.lastName}` : null,
                raisedByEmail: raisedBy?.email || null,
                assignedToEmail: assignedTo?.email || null,
                createdAt: ticket.createdAt,
                updatedAt: ticket.updatedAt
            };

            return mappedTicket;
        } catch (error) {
            console.error(' TicketDB.getTicketById: Database error:', error);
            throw error;
        }
    }

    static async getTicketsByDtrId(dtrId) {
        try {
            // Handle both string and numeric dtrId
            const numericDtrId = typeof dtrId === 'string' ? parseInt(dtrId) : dtrId;
            
            return await prisma.tickets.findMany({
                where: { dtrId: numericDtrId },
                include: {
                    users_raisedBy: {
                        select: {
                            username: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    users_assignedTo: {
                        select: {
                            username: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            console.error(' TicketDB.getTicketsByDtrId: Database error:', error);
            throw error;
        }
    }

    static async getDtrDetails(dtrNumber) {
        try {
            // Try to find DTR by exact dtrNumber first
            let dtr = await prisma.dtrs.findUnique({
                where: { dtrNumber },
                include: {
                    locations: {
                        select: {
                            name: true,
                            address: true
                        }
                    },
                    meters: {
                        select: {
                            meterNumber: true,
                            serialNumber: true,
                            manufacturer: true,
                            model: true,
                            type: true,
                            status: true
                        }
                    }
                }
            });

            // If not found, try to find by partial match (handles cases like "201" vs "DTR-201")
            if (!dtr) {
                dtr = await prisma.dtrs.findFirst({
                    where: {
                        dtrNumber: {
                            contains: dtrNumber.toString()
                        }
                    },
                    include: {
                        locations: {
                            select: {
                                name: true,
                                address: true
                            }
                        },
                        meters: {
                            select: {
                                meterNumber: true,
                                serialNumber: true,
                                manufacturer: true,
                                model: true,
                                type: true,
                                status: true
                            }
                        }
                    }
                });
            }

            // If still not found, try to find by dtrNumber ending with the provided value
            if (!dtr) {
                dtr = await prisma.dtrs.findFirst({
                    where: {
                        dtrNumber: {
                            endsWith: dtrNumber.toString()
                        }
                    },
                    include: {
                        locations: {
                            select: {
                                name: true,
                                address: true
                            }
                        },
                        meters: {
                            select: {
                                meterNumber: true,
                                serialNumber: true,
                                manufacturer: true,
                                model: true,
                                type: true,
                                status: true
                            }
                        }
                    }
                });
            }

            if (!dtr) {
                return null;
            }

            // Get the first meter as feeder (since feeder is the meter assigned to DTR)
            const feeder = dtr.meters && dtr.meters.length > 0 ? dtr.meters[0] : null;

            return {
                dtrId: dtr.id,
                dtrNumber: dtr.dtrNumber,
                location: dtr.locations?.name || dtr.locations?.address || null,
                feeder: feeder ? {
                    meterNumber: feeder.meterNumber,
                    serialNumber: feeder.serialNumber,
                    manufacturer: feeder.manufacturer,
                    model: feeder.model,
                    type: feeder.type,
                    status: feeder.status
                } : null
            };
        } catch (error) {
            console.error('TicketDB.getDtrDetails: Database error:', error);
            throw error;
        }
    }



    static async generateTicketNumber() {
        try {
            const ticketCount = await prisma.tickets.count();
            const generatedNumber = generateTicketNumber(ticketCount);
            return generatedNumber;
        } catch (error) {
            console.error('TicketDB.generateTicketNumber: Database error:', error);
            throw error;
        }
    }

    static async createTicket(ticketData) {
        try {
            // Generate unique ticket number
            const ticketNumber = await this.generateTicketNumber();
            
            // Get current user ID from the session
            const raisedById = ticketData.raisedById || 1;
            
            // Prepare the data for database insertion
            const ticketCreateData = {
                ticketNumber,
                raisedById,
                type: ticketData.type,
                category: ticketData.category,
                priority: ticketData.priority,
                status: ticketData.status || 'OPEN',
                subject: ticketData.subject,
                description: ticketData.description,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Handle DTR ID - convert dtrNumber to dtrId if needed
            if (ticketData.dtrId) {
                // If dtrId is a string (like "DTR-002"), look up the actual ID
                if (typeof ticketData.dtrId === 'string' && ticketData.dtrId.startsWith('DTR-')) {
                    const dtr = await prisma.dtrs.findUnique({
                        where: { dtrNumber: ticketData.dtrId },
                        select: { id: true }
                    });
                    
                    if (dtr) {
                        ticketCreateData.dtrId = dtr.id;
                    }
                } else if (typeof ticketData.dtrId === 'number' || (typeof ticketData.dtrId === 'string' && !isNaN(ticketData.dtrId))) {
                    // If it's already a number or can be converted to number
                    const numericDtrId = parseInt(ticketData.dtrId);
                    ticketCreateData.dtrId = numericDtrId;
                }
                
                // If dtrId is still not resolved, try to find by partial match
                if (!ticketCreateData.dtrId && typeof ticketData.dtrId === 'string') {
                    const dtr = await prisma.dtrs.findFirst({
                        where: {
                            dtrNumber: {
                                contains: ticketData.dtrId
                            }
                        },
                        select: { id: true }
                    });
                    
                    if (dtr) {
                        ticketCreateData.dtrId = dtr.id;
                    }
                }
            }
            
            // Add other optional fields if they exist
            if (ticketData.assignedToId) {
                ticketCreateData.assignedToId = ticketData.assignedToId;
            }
            
            // Try to create the ticket
            let ticket;
            try {
                ticket = await prisma.tickets.create({
                    data: ticketCreateData,
                    include: {
                        dtrs: {
                            include: {
                                locations: true
                            }
                        },
                        users_tickets_raisedByIdTousers: {
                            select: {
                                username: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        },
                        users_tickets_assignedToIdTousers: {
                            select: {
                                username: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                });
            } catch (createError) {
                // If it's a unique constraint error on ID, try to fix the sequence
                if (createError.message.includes('Unique constraint failed on the fields: (`id`)')) {
                    // Get the current highest ID
                    const highestTicket = await prisma.tickets.findFirst({
                        orderBy: { id: 'desc' },
                        select: { id: true }
                    });
                    
                    if (highestTicket) {
                        // Try to create with explicit ID
                        const nextId = highestTicket.id + 1;
                        ticketCreateData.id = nextId;
                        
                        ticket = await prisma.tickets.create({
                            data: ticketCreateData,
                            include: {
                                dtrs: {
                                    include: {
                                        locations: true
                                    }
                                },
                                users_tickets_raisedByIdTousers: {
                                    select: {
                                        username: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true
                                    }
                                },
                                users_tickets_assignedToIdTousers: {
                                    select: {
                                        username: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true
                                    }
                                }
                            }
                        });
                    } else {
                        throw createError;
                    }
                } else {
                    throw createError;
                }
            }
            
            return ticket;
        } catch (error) {
            console.error('TicketDB.createTicket: Database error:', error);
            throw error;
        }
    }

    
}

export default TicketDB; 