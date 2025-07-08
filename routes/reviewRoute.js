import express from 'express';
import { createReview, deleteReview, getAllReports, getProviderReviews, getReviewDetails, getReviewStats, getUserReviews, reportProvider, reportReview, reportUser, updateReportStatus, updateReview } from '../controllers/reviewController.js';
import singleUpload from '../middlewares/multer.js';
import {authorizeRoles, isAuthenticated, isVerified} from '../middlewares/auth.js'

const router = express.Router();

router.post("/create", isAuthenticated, isVerified, singleUpload, authorizeRoles('user'), createReview);
router.get("/get/:providerId", isAuthenticated, isVerified, getProviderReviews);
router.get("/get-review/:reviewId", isAuthenticated, isVerified, getReviewDetails);
router.put("/update-review/:reviewId", isAuthenticated, isVerified, singleUpload, updateReview);
router.delete("/delete-review/:reviewId", isAuthenticated, isVerified, singleUpload, deleteReview);
router.get("/get-user-review", isAuthenticated, isVerified, getUserReviews);
router.get("/get-review-stats/:providerId", isAuthenticated, isVerified, getReviewStats);
router.post("/:reviewId/report-review", isAuthenticated, isVerified, reportReview);
router.post("/:userId/report-user", isAuthenticated, isVerified, authorizeRoles('provider'), reportUser);
router.post("/:providerId/report-provider", isAuthenticated, isVerified, authorizeRoles('user'), reportProvider);
router.get("/get-all-reports", isAuthenticated, authorizeRoles('admin'), getAllReports);
router.put("/:reportId/update-report-status", isAuthenticated, authorizeRoles('admin'), updateReportStatus)

export default router;