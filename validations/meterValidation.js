import { z } from 'zod';

// Meter validation schema
export const createMeterSchema = z.object({
    meterNumber: z.string().min(1, 'Meter number is required'),
    serialNumber: z.string().min(1, 'Serial number is required'),
    manufacturer: z.string().min(1, 'Manufacturer is required'),
    model: z.string().min(1, 'Model is required'),
    type: z.string().min(1, 'Type is required'),
    phase: z.string().min(1, 'Phase is required'),
    locationId: z.number().positive('Location ID must be a positive number'),
    installationDate: z.string().min(1, 'Installation date is required')
        .refine((val) => !isNaN(new Date(val).getTime()), 'Invalid installation date'),
    dtrId: z.number().positive('DTR ID must be a positive number').optional()
});

// Validation middleware
export const validateMeterData = (schema) => {
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