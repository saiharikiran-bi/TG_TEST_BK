import { z } from 'zod';

// Ticket validation schema
export const createTicketSchema = z.object({
    subject: z.string().min(1, 'Subject is required').max(255, 'Subject must be less than 255 characters'),
    description: z.string().min(1, 'Description is required'),
    type: z.enum(['COMPLAINT', 'SERVICE_REQUEST', 'INQUIRY'], {
        errorMap: () => ({ message: 'Type must be one of: COMPLAINT, SERVICE_REQUEST, INQUIRY' })
    }),
    category: z.enum(['BILLING', 'METER', 'CONNECTION', 'TECHNICAL', 'OTHER'], {
        errorMap: () => ({ message: 'Category must be one of: BILLING, METER, CONNECTION, TECHNICAL, OTHER' })
    }),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'], {
        errorMap: () => ({ message: 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT' })
    }).optional().default('MEDIUM'),
    dtrId: z.string().nullable().optional(), // Accept string or null for DTR ID
    feederNumber: z.string().nullable().optional(), // Accept Feeder Number
    location: z.string().nullable().optional(), // Accept Location
    assignedToId: z.number().positive('Assigned to ID must be a positive number').optional(),
    status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], {
        errorMap: () => ({ message: 'Status must be one of: OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED' })
    }).optional().default('OPEN'),
    attachments: z.any().optional() // Accept any type for attachments
});

// Update ticket status schema
export const updateTicketStatusSchema = z.object({
    status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], {
        errorMap: () => ({ message: 'Status must be one of: OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED' })
    })
});

// Assign ticket schema
export const assignTicketSchema = z.object({
    assignedToId: z.number().positive('Assigned to ID must be a positive number')
});

// Validation middleware
export const validateTicketData = (schema) => {
    return (req, res, next) => {
        try {
            const validatedData = schema.parse(req.body);
            req.validatedData = validatedData;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors
                });
            }
            
            return res.status(500).json({
                success: false,
                message: 'Validation error',
                error: error.message
            });
        }
    };
}; 