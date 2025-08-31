import express from 'express';
import { 
    getTicketStats, 
    getTicketsTable, 
    getTicketTrends, 
    getTicketById, 
    createTicket, 
    getDtrDetails,
    getTicketActivityLog,
    updateTicket,
    updateTicketStatus,
    assignTicket,
    deleteTicket
} from '../controllers/ticketController.js';
import { validateTicketData, createTicketSchema } from '../validations/ticketValidation.js';
import { populateUserFromCookies } from '../utils/cookieUtils.js';


const router = express.Router();

router.use(populateUserFromCookies);


router.get('/stats', getTicketStats);
router.get('/table', getTicketsTable);
router.get('/trends', getTicketTrends);
router.get('/dtr/:dtrNumber', getDtrDetails);
router.get('/:id/activity-log', getTicketActivityLog);
router.get('/:id', getTicketById);
router.post('/', validateTicketData(createTicketSchema), createTicket);
router.put('/:id', updateTicket);
router.put('/:id/status', updateTicketStatus);
router.put('/:id/assign', assignTicket);
router.delete('/:id', deleteTicket);

export default router; 