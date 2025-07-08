import express from 'express';
import { approveProviderKyc, getAllBookings, getBookingAnalytics, getDashboardStats, rejectProviderKyc, toggleProviderSuspension } from '../controllers/adminController.js';
import { authorizeRoles, isAuthenticated } from '../middlewares/auth.js';
import { getChatStats } from '../controllers/chatController.js';

const router = express.Router();
router.get('/analytics', isAuthenticated, authorizeRoles('admin'), getBookingAnalytics)
router.get('/chat-stats',isAuthenticated,authorizeRoles('admin'),getChatStats);
router.get("/dashboard-stats", isAuthenticated, authorizeRoles("admin"), getDashboardStats);
router.put("/:providerId/approve-kyc", isAuthenticated, authorizeRoles("admin"), approveProviderKyc);
router.put("/:providerId/reject-kyc", isAuthenticated, authorizeRoles("admin"), rejectProviderKyc);
router.put("/:providerId/suspension", isAuthenticated, authorizeRoles("admin"), toggleProviderSuspension);
router.get("/get-bookings", isAuthenticated, authorizeRoles("admin"), getAllBookings);


export default router;