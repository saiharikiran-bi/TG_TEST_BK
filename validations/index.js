// Consumer validations
export { 
    addConsumerSchema, 
    validateConsumerData 
} from './consumerValidation.js';

// User validations
export { 
    addUserSchema, 
    assignRolesSchema, 
    validateUserData 
} from './userValidation.js';

// Role validations
export { 
    addRoleSchema, 
    assignPermissionsSchema, 
    validateRoleData 
} from './roleValidation.js';

// Meter validations
export { 
    createMeterSchema, 
    validateMeterData 
} from './meterValidation.js';

// Ticket validations
export { 
    createTicketSchema, 
    updateTicketStatusSchema, 
    assignTicketSchema, 
    validateTicketData 
} from './ticketValidation.js';

// Asset validations
export { 
    addAssetSchema, 
    bulkUploadAssetsSchema, 
    validateAssetData 
} from './assetValidation.js'; 