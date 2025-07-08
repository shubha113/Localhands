import express from 'express';
import { forgotPassword, resetPassword, login, logout, resendEmailVerification, verifyEmail, changePassword, sendPhoneOTP, verifyPhoneOTP, getMe, requestPhoneUpdate, verifyUpdatedPhoneOTP, updateProfile, uploadAvatar, updateProviderProfile } from '../controllers/authController.js';
import { isAuthenticated } from '../middlewares/auth.js';
import singleUpload from '../middlewares/multer.js';
import { User } from '../models/User.js';

const router = express.Router();


router.post("/create-admin", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: "Admin already exists" });
    }

    const admin = await User.create({
      name,
      email,
      password,
      phone,
      role: "admin",
      isVerified: true,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("Error creating admin:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});



router.post("/login", login);
router.get("/logout", isAuthenticated, logout);
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-email", resendEmailVerification);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.put("/change-password", isAuthenticated, changePassword);
router.post("/send-phone-otp", isAuthenticated, sendPhoneOTP);
router.post('/verify-phone-otp', isAuthenticated, verifyPhoneOTP);
router.post('/request-phone-update', isAuthenticated, requestPhoneUpdate);
router.post('/verify-updated-otp', isAuthenticated, verifyUpdatedPhoneOTP);
router.get('/me', isAuthenticated, getMe);
router.put('/me/update', isAuthenticated, updateProfile);
router.put("/me/avatar", isAuthenticated, singleUpload, uploadAvatar);
router.patch('/me/provider', isAuthenticated, updateProviderProfile);

export default router;