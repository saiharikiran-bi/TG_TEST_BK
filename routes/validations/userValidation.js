import { z } from 'zod';

// User validation schema
export const addUserSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    firstName: z.string().min(1, 'First name is required').max(100, 'First name must be less than 100 characters'),
    lastName: z.string().min(0, 'Last name can be empty').max(100, 'Last name must be less than 100 characters').optional(),
    phone: z.string().optional(),
    isActive: z.boolean().optional().default(true),
    roleId: z.number().min(1, 'Role is required'),
    locationId: z.number().min(1, 'Location is required')
});

// Assign roles validation schema
export const assignRolesSchema = z.object({
    roleId: z.number().min(1, 'Role ID is required')
});

// Validation middleware
export const validateUserData = (schema) => {
    return (req, res, next) => {
        console.log('🔍 === USER VALIDATION STARTED ===');
        console.log('📋 Request body:', req.body);
        console.log('📋 Schema to validate against:', schema.description || 'User schema');
        
        try {
            console.log('✅ Attempting to parse and validate data...');
            console.log('📋 Data types in request body:', {
                username: typeof req.body.username,
                email: typeof req.body.email,
                password: typeof req.body.password,
                firstName: typeof req.body.firstName,
                lastName: typeof req.body.lastName,
                phone: typeof req.body.phone,
                isActive: typeof req.body.isActive,
                roleId: typeof req.body.roleId,
                roleIdValue: req.body.roleId
            });
            
            const validatedData = schema.parse(req.body);
            console.log('✅ Validation successful');
            console.log('📊 Validated data:', { ...validatedData, password: '[HIDDEN]' });
            
            req.validatedData = validatedData;
            console.log('📋 Validated data attached to request object');
            console.log('🎉 === USER VALIDATION COMPLETED SUCCESSFULLY ===');
            
            next();
        } catch (error) {
            console.error('💥 === USER VALIDATION FAILED ===');
            
            if (error instanceof z.ZodError) {
                console.log('❌ Zod validation errors:');
                if (error.errors && Array.isArray(error.errors)) {
                    const errors = error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }));
                    
                    errors.forEach(err => {
                        console.log(`   ${err.field}: ${err.message}`);
                    });
                    
                    console.log('🔄 Sending 400 validation error response');
                    return res.status(400).json({
                        success: false,
                        message: 'Validation failed',
                        errors
                    });
                } else {
                    console.log('❌ Zod error but no errors array:', error);
                    return res.status(400).json({
                        success: false,
                        message: 'Validation failed',
                        error: error.message
                    });
                }
            }
            
            console.error('❌ Non-Zod validation error:', error.message);
            console.log('🔄 Sending 500 validation error response');
            return res.status(500).json({
                success: false,
                message: 'Validation error',
                error: error.message
            });
        }
    };
};
