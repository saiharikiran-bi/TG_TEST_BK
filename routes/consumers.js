import express from 'express';
import { getAllConsumers, getConsumerByNumber, getPowerWidgets, getConsumerHistory, addConsumer } from '../controllers/consumerController.js';
import { validateConsumerData, addConsumerSchema } from '../validations/consumerValidation.js';

const router = express.Router();

router.get('/', getAllConsumers);
router.get('/widgets', getPowerWidgets);
router.get('/history/:consumerNumber', getConsumerHistory);
router.get('/:consumerNumber', getConsumerByNumber);
router.post('/', validateConsumerData(addConsumerSchema), addConsumer);

export default router; 