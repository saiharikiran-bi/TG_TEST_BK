import express from 'express';
import { getAllUsers, getUserStats, addUser, getUserById, updateUser, deleteUser, getAllRoles, getAllLocations } from '../controllers/userController.js';
import { validateUserData, addUserSchema } from '../validations/userValidation.js';
import { populateUserFromCookies } from '../utils/cookieUtils.js';


const router = express.Router();

router.use(populateUserFromCookies);

router.post('/', validateUserData(addUserSchema), addUser);
router.get('/', getAllUsers);
router.get('/stats', getUserStats);
router.get('/roles', getAllRoles); 
router.get('/locations', getAllLocations); 
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router; 