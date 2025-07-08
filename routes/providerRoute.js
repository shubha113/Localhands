import express from 'express';
import multer from 'multer'
import { registerProvider } from '../controllers/authController.js';
import { addPortfolioItem, deletePortfolioItem, getEarningsSummary, toggleAvailability, updatePortfolioItem, updateWorkingHours, uploadKYC, getProviderBookingHistory } from '../controllers/providerController.js';
import { authorizeRoles, isAuthenticated } from '../middlewares/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});



router.post('/register-provider', registerProvider);
router.post("/upload-kyc", isAuthenticated, authorizeRoles('provider'), upload.fields([
    { name: "aadharImage", maxCount: 1 },
    { name: "panImage", maxCount: 1 },
  ]),
  uploadKYC
);
router.post("/portfolio",isAuthenticated, authorizeRoles('provider'), upload.array("images", 5), addPortfolioItem);
router.route('/portfolio/:portfolioId').put(isAuthenticated, authorizeRoles('provider'), updatePortfolioItem).delete(isAuthenticated, authorizeRoles('provider'), deletePortfolioItem);
router.patch("/toggle-availability",isAuthenticated, authorizeRoles('provider'), toggleAvailability);
router.get("/earning-summary",isAuthenticated, authorizeRoles('provider'), getEarningsSummary);
router.put("/working-hours",isAuthenticated, authorizeRoles('provider'), updateWorkingHours);
router.get('/provider-booking-history', isAuthenticated, authorizeRoles('provider'), getProviderBookingHistory);


export default router;