import { z } from 'zod';

// Meter validation schema
const meterSchema = z.object({
    meterNumber: z.string().min(1, 'Meter number is required'),
    serialNumber: z.string().min(1, 'Serial number is required'),
    manufacturer: z.string().min(1, 'Manufacturer is required'),
    model: z.string().min(1, 'Model is required'),
    type: z.string().min(1, 'Type is required'),
    phase: z.string().min(1, 'Phase is required'),
    installationDate: z.string().min(1, 'Installation date is required'),
    locationId: z.string().min(1, 'Location ID is required')
});

// Document validation schema
const documentSchema = z.object({
    type: z.string().min(1, 'Document type is required'),
    url: z.string().url('Document URL must be a valid URL')
});

// Main consumer validation schema
export const addConsumerSchema = z.object({
    consumerNumber: z.string().min(1, 'Consumer number is required'),
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    primaryPhone: z.string().min(1, 'Primary phone is required')
        .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format'),
    secondaryPhone: z.string().optional(),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    idType: z.string().min(1, 'ID type is required'),
    idNumber: z.string().min(1, 'ID number is required'),
    connectionType: z.string().min(1, 'Connection type is required'),
    category: z.string().min(1, 'Category is required'),
    sanctionedLoad: z.string().min(1, 'Sanctioned load is required')
        .refine((val) => parseFloat(val) > 0, 'Sanctioned load must be greater than 0'),
    connectionDate: z.string().min(1, 'Connection date is required')
        .refine((val) => !isNaN(new Date(val).getTime()), 'Invalid connection date'),
    billingCycle: z.string().min(1, 'Billing cycle is required'),
    locationId: z.string().min(1, 'Location ID is required'),
    address: z.string().optional(),
    meters: z.array(meterSchema).optional(),
    documents: z.array(documentSchema).optional()
});

// Validation middleware
export const validateConsumerData = (schema) => {
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