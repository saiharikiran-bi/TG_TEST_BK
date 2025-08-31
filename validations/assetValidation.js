import { z } from 'zod';

// Location-based asset schema for the current addAsset method
const locationAssetSchema = z.object({
    location_type_name: z.string().min(1, 'Location type name is required'),
    parent_location: z.string().optional().nullable(),
    location_names: z.array(z.string()).optional().default([]),
    code: z.string().optional(),
    address: z.string().optional(),
    pincode: z.string().optional(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable()
});

// Individual asset schema (for future use)
const assetSchema = z.object({
    name: z.string().min(1, 'Asset name is required'),
    type: z.string().min(1, 'Asset type is required'),
    serialNumber: z.string().min(1, 'Serial number is required'),
    manufacturer: z.string().min(1, 'Manufacturer is required'),
    model: z.string().min(1, 'Model is required'),
    locationId: z.number().positive('Location ID must be a positive number'),
    installationDate: z.string().min(1, 'Installation date is required')
        .refine((val) => !isNaN(new Date(val).getTime()), 'Invalid installation date'),
    status: z.enum(['active', 'inactive', 'maintenance', 'retired']).optional().default('active'),
    description: z.string().optional(),
    specifications: z.record(z.any()).optional()
});

// Single location asset validation schema
export const addAssetSchema = locationAssetSchema;

// Bulk upload validation schema
export const bulkUploadAssetsSchema = z.object({
    assets: z.array(locationAssetSchema).min(1, 'At least one asset is required')
});

// Validation middleware
export const validateAssetData = (schema) => {
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