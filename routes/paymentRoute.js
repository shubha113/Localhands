import express from 'express';
import { createPayment, refundPayment, verifyPayment } from '../controllers/paymentController.js';
import { authorizeRoles, isAuthenticated } from '../middlewares/auth.js';

const router = express.Router();

router.post('/create-payment', isAuthenticated, authorizeRoles('user'), createPayment);
router.post('/verify-payment', isAuthenticated, verifyPayment);
router.post('/refund-payment', isAuthenticated, refundPayment);


export  default router;