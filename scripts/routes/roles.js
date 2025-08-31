import express from 'express';
import { getAllRoles, addRole, getRoleById, updateRole, deleteRole, assignPermissionsToRole } from '../controllers/roleController.js';
import { validateRoleData, addRoleSchema, assignPermissionsSchema } from '../validations/roleValidation.js';
import { populateUserFromCookies } from '../utils/cookieUtils.js';

const router = express.Router();

router.use(populateUserFromCookies);


router.get('/', getAllRoles);
router.get('/:id', getRoleById);
router.post('/', validateRoleData(addRoleSchema), addRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);
router.post('/:id/assign-permissions', validateRoleData(assignPermissionsSchema), assignPermissionsToRole);

export default router; 