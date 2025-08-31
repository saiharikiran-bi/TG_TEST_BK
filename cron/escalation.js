import { escalationLevels } from './utils/escalationLevels.js';

export async function escalateTickets(prisma) {
    try {
        console.log('🔄 Starting ticket escalation check...');
        
        // Find tickets that need escalation
        const ticketsToEscalate = await prisma.tickets.findMany({
            where: {
                status: { in: ['OPEN', 'ASSIGNED'] },
                priority: { in: ['HIGH', 'URGENT'] },
                createdAt: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Older than 24 hours
                }
            },
            include: {
                raisedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        console.log(`📋 Found ${ticketsToEscalate.length} tickets that may need escalation`);

        for (const ticket of ticketsToEscalate) {
            try {
                // Check if escalation is needed based on time and priority
                const hoursSinceCreation = (Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60);
                
                let shouldEscalate = false;
                let escalationLevel = 1;

                if (ticket.priority === 'URGENT' && hoursSinceCreation > 4) {
                    shouldEscalate = true;
                    escalationLevel = 2;
                } else if (ticket.priority === 'HIGH' && hoursSinceCreation > 8) {
                    shouldEscalate = true;
                    escalationLevel = 2;
                } else if (hoursSinceCreation > 24) {
                    shouldEscalate = true;
                    escalationLevel = 2;
                }

                if (shouldEscalate) {
                    // Log escalation (no notifications - only TGNPDCL alerts are supported)
                    console.log(`🚨 [ESCALATION] Ticket ${ticket.ticketNumber} escalated to level ${escalationLevel}`);
                    console.log(`📝 [ESCALATION] Ticket details: ${ticket.subject}, Priority: ${ticket.priority}, Status: ${ticket.status}`);
                }
            } catch (error) {
                console.error(`❌ [ESCALATION] Error processing ticket ${ticket.ticketNumber}:`, error);
            }
        }

        console.log('✅ Ticket escalation check completed');
        
    } catch (error) {
        console.error('❌ Error in ticket escalation:', error);
        throw error;
    }
}