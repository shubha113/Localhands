import express from 'express';
import { registerUser } from '../controllers/authController.js';
import { checkProviderAvailability, getAllNearbyProviders, getProviderDetails, getUserBookingHistory, searchProviders } from '../controllers/userController.js';
import { authorizeRoles, isAuthenticated, isVerified } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register-user', registerUser);
router.get('/get-poviders', isAuthenticated, authorizeRoles('user'), getAllNearbyProviders);
router.get('/get-povider-details/:id', getProviderDetails);
router.get('/search-providers', searchProviders);
router.get('/booking-history', isAuthenticated, authorizeRoles('user'), isVerified, getUserBookingHistory);
router.get('/availability', isAuthenticated, authorizeRoles('user'), isVerified, checkProviderAvailability);
export default router;