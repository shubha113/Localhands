import express from 'express';
import { subscribePush } from '../controllers/notificationController.js';
import { isAuthenticated } from '../middlewares/auth.js';

const router = express.Router();
router.post("/subscription",isAuthenticated, subscribePush);

export default router;