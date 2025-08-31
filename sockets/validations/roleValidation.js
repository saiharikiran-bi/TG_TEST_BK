import { z } from 'zod';

// Role validation schema
export const addRoleSchema = z.object({
    name: z.string()
        .min(2, 'Role name must be at least 2 characters')
        .max(50, 'Role name must be less than 50 characters')
        .regex(/^[a-zA-Z0-9\s]+$/, 'Role name can only contain letters, numbers, and spaces'),
    description: z.string().optional(),
    isActive: z.boolean().optional().default(true),
    permissionIds: z.array(z.number()).optional()
});

// Assign permissions validation schema
export const assignPermissionsSchema = z.object({
    permissionIds: z.array(z.number()).min(1, 'At least one permission ID is required')
});

// Validation middleware
export const validateRoleData = (schema) => {
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