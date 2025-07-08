import express from 'express';
import { acceptBooking, cancelBooking, completeBookingWithOTP, createBooking, generateCompletionOTP, getBookingDetails, getMyBookings, rejectBooking, rescheduleBooking } from '../controllers/bookingController.js';
import {authorizeRoles, isAuthenticated, isVerified} from '../middlewares/auth.js'

const router = express.Router();

router.post("/create", isAuthenticated, authorizeRoles('user'), createBooking);
router.put("/:id/accept", isAuthenticated, authorizeRoles('provider'), isVerified, acceptBooking);
router.put("/:id/reject", isAuthenticated, authorizeRoles('provider'), isVerified, rejectBooking);
router.post("/:id/completion-otp", isAuthenticated, authorizeRoles('provider'), isVerified, generateCompletionOTP);
router.put("/:id/complete", isAuthenticated, authorizeRoles('provider'), isVerified, completeBookingWithOTP);
router.put("/:id/cancel", isAuthenticated, isVerified, cancelBooking);
router.get("/:id/single-booking", isAuthenticated, isVerified, getBookingDetails);
router.get("/my-bookings", isAuthenticated, isVerified, getMyBookings);
router.patch("/:id/reshedule-booking", isAuthenticated, isVerified, rescheduleBooking);

export default router;