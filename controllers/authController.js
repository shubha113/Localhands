import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/User.js";
import { Provider } from "../models/Provider.js";
import ErrorHandler from "../utils/errorHandler.js";
import sendEmail from "../utils/sendEmail.js";
import { sendTokenResponse } from "../utils/generateToken.js";
import crypto from "crypto";
import { generateOTP, sendSMS } from "../utils/sendSms.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import {SERVICE_CATEGORIES, SERVICE_SUBCATEGORIES} from '../utils/constants.js';

//Register User
/*export const registerUser = catchAsyncError(async (req, res, next) => {
  const { name, email, password, phone, address, latitude, longitude } = req.body;

  if (!name || !email || !password || !phone || !address) {
    return next(new ErrorHandler("Please Enter all the fields", 400));
  }

  //check if user already exists
  const existingUser =
    (await User.findOne({ email })) || (await Provider.findOne({ email }));
  if (existingUser) {
    return next(new ErrorHandler("User already exists with this email", 400));
  }

  const user = await User.create({ name, email, password, phone, address });

  //generate email verification token
  const verificationToken = user.getEmailVerificationToken();
  console.log("Raw token to send:", verificationToken);
  await user.save({ validateBeforeSave: false });

  //send verification email
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
  const message = `
        Welcome to LocalHands! Please verify your email by clicking the link below:
        
        ${verificationUrl}
        
        This link will expire in 24 hours.
        
        If you didn't create this account, please ignore this email.
    `;

  try {
    await sendEmail({
      email: user.email,
      subject: "Localhands - Email verification",
      message,
    });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    user.getEmailVerificationToken = false;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorHandler("Email could not be sent", 500));
  }
});*/

export const registerUser = catchAsyncError(async (req, res, next) => {
  const { name, email, password, phone, address } = req.body;

  if (!name || !email || !password || !phone || !address) {
    return next(new ErrorHandler("Please provide all required fields", 400));
  }

  const { latitude, longitude } = address.coordinates;

  const existingUser =
    (await User.findOne({ email })) || (await Provider.findOne({ email }));
  if (existingUser) {
    return next(new ErrorHandler("User already exists with this email", 400));
  }

  const user = await User.create({
    name,
    email,
    password,
    phone,
    address: {
      street: address.street,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      coordinates: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
    },
    location: {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    },
  });

  const verificationToken = user.getEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
  const message = `
    Welcome to LocalReviews! Please verify your email by clicking the link below:

    ${verificationUrl}

    This link will expire in 24 hours.

    If you didn't create this account, please ignore this email.
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: "LocalReviews - Email Verification",
      message,
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorHandler("Email could not be sent", 500));
  }
});

// Register Provider
/*export const registerProvider = catchAsyncError(async (req, res, next) => {
  const {
    name,
    email,
    password,
    phone,
    businessName,
    description,
    experience,
    services,
    serviceAreas,
  } = req.body;

  // Check if provider already exists
  const existingProvider =
    (await Provider.findOne({ email })) || (await User.findOne({ email }));
  if (existingProvider) {
    return next(new ErrorHandler("User already exists with this email", 400));
  }

  const provider = await Provider.create({
    name,
    email,
    password,
    phone,
    businessName,
    description,
    experience,
    services,
    serviceAreas,
  });

  // Generate email verification token
  const verificationToken = provider.getEmailVerificationToken();
  await provider.save({ validateBeforeSave: false });

  // Send verification email
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

  const message = `
        Welcome to LocalReviews as a Service Provider! Please verify your email by clicking the link below:
        
        ${verificationUrl}
        
        This link will expire in 24 hours.
        
        After email verification, please complete your KYC documentation for account approval.
        
        If you didn't create this account, please ignore this email.
    `;

  try {
    await sendEmail({
      email: provider.email,
      subject: "LocalReviews - Provider Email Verification",
      message,
    });

    sendTokenResponse(provider, 201, res);
  } catch (error) {
    provider.emailVerificationToken = undefined;
    provider.emailVerificationExpire = undefined;
    await provider.save({ validateBeforeSave: false });

    return next(new ErrorHandler("Email could not be sent", 500));
  }
});*/

export const registerProvider = catchAsyncError(async (req, res, next) => {
  const {
    name,
    email,
    password,
    phone,
    businessName,
    description,
    experience,
    services,
    serviceAreas,
    latitude,
    longitude,
  } = req.body;

  // ✅ Basic required fields validation
  if (
    !name ||
    !email ||
    !password ||
    !phone ||
    !businessName ||
    experience === undefined ||
    latitude === undefined ||
    longitude === undefined
  ) {
    return next(
      new ErrorHandler("Please provide all required fields including coordinates", 400)
    );
  }

  // ✅ Validate services structure if provided
  if (services && Array.isArray(services)) {
    const validUnits = [
      "per job",
      "1 sqft",
      "1 room",
      "1 hour",
      "1 day",
      "per day",
      "per task",
    ];

    const seen = new Set(); // To prevent duplicate category-subcategory

    for (const service of services) {
      const { category, subcategory, price, unit } = service;

      // Check if all fields exist
      if (!category || !subcategory || price === undefined || !unit) {
        return next(
          new ErrorHandler(
            "Each service must have category, subcategory, price, and unit",
            400
          )
        );
      }

      // Check for duplicate services
      const key = `${category}-${subcategory}`;
      if (seen.has(key)) {
        return next(new ErrorHandler("Duplicate service entry detected", 400));
      }
      seen.add(key);

      // Validate category
      if (!SERVICE_CATEGORIES.includes(category)) {
        return next(
          new ErrorHandler(`Invalid service category: ${category}`, 400)
        );
      }

      // Validate subcategory
      if (
        !SERVICE_SUBCATEGORIES[category] ||
        !SERVICE_SUBCATEGORIES[category].includes(subcategory)
      ) {
        return next(
          new ErrorHandler(
            `Invalid subcategory '${subcategory}' for category '${category}'`,
            400
          )
        );
      }

      // Validate price
      if (price < 0) {
        return next(new ErrorHandler("Service price cannot be negative", 400));
      }

      // Validate unit (required)
      if (!validUnits.includes(unit)) {
        return next(
          new ErrorHandler(
            `Invalid unit '${unit}'. Valid units are: ${validUnits.join(", ")}`,
            400
          )
        );
      }
    }
  }

  // ✅ Check if provider or user already exists with this email
  const existingProvider =
    (await Provider.findOne({ email })) || (await User.findOne({ email }));

  if (existingProvider) {
    return next(new ErrorHandler("User already exists with this email", 400));
  }

  // ✅ Create the provider
  const provider = await Provider.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    phone,
    businessName: businessName.trim(),
    description: description?.trim(),
    experience,
    services: services || [],
    serviceAreas: serviceAreas || [],
    location: {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    },
  });

  // ✅ Generate email verification token
  const verificationToken = provider.getEmailVerificationToken();
  await provider.save({ validateBeforeSave: false });

  // ✅ Send verification email
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
  const message = `
    Welcome to LocalReviews as a Service Provider! Please verify your email by clicking the link below:
    
    ${verificationUrl}
    
    This link will expire in 24 hours.

    After email verification, please complete your KYC documentation for account approval.

    If you didn't create this account, please ignore this email.
  `;

  try {
    await sendEmail({
      email: provider.email,
      subject: "LocalReviews - Provider Email Verification",
      message,
    });

    sendTokenResponse(provider, 201, res);
  } catch (error) {
    provider.emailVerificationToken = undefined;
    provider.emailVerificationExpire = undefined;
    await provider.save({ validateBeforeSave: false });

    return next(new ErrorHandler("Email could not be sent", 500));
  }
});

// Login User/Provider
export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password is entered
  if (!email || !password) {
    return next(new ErrorHandler("Please enter email and password", 400));
  }

  // Find user in both collections
  let user = await User.findOne({ email }).select("+password");
  if (!user) {
    user = await Provider.findOne({ email }).select("+password");
  }

  if (!user) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // Check if password matches
  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // Check if account is active
  if (!user.isActive) {
    return next(new ErrorHandler("Your account has been suspended", 403));
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res);
});

// Logout
export const logout = catchAsyncError(async (req, res, next) => {
  const userType = req.userType || "unknown";
  const userName = req.user?.name || "Unknown";

  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  res.status(200).json({
    success: true,
    message: `Logged out successfully: ${userName} (${userType})`,
  });
});

//verify email
export const verifyEmail = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;

  // Hash token
  const emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // Find user with this token
  let user = await User.findOne({
    emailVerificationToken,
    emailVerificationExpire: { $gt: Date.now() },
  });

  if (!user) {
    user = await Provider.findOne({
      emailVerificationToken,
      emailVerificationExpire: { $gt: Date.now() },
    });
  }

  if (!user) {
    return next(
      new ErrorHandler(
        "Email verification token is invalid or has expired",
        400
      )
    );
  }

  // Verify email
  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Email verified successfully",
  });
});

// Resend Email Verification
export const resendEmailVerification = catchAsyncError(
  async (req, res, next) => {
    const { email } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      user = await Provider.findOne({ email });
    }

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    if (user.isVerified) {
      return next(new ErrorHandler("Email is already verified", 400));
    }

    // Generate new verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

    const message = `
        Please verify your email by clicking the link below:
        
        ${verificationUrl}
        
        This link will expire in 24 hours.
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: "LocalReviews - Email Verification",
        message,
      });

      res.status(200).json({
        success: true,
        message: "Email verification link sent successfully",
      });
    } catch (error) {
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return next(new ErrorHandler("Email could not be sent", 500));
    }
  }
);

// Forgot Password
export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  let user = await User.findOne({ email });
  if (!user) {
    user = await Provider.findOne({ email });
  }

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Get reset password token
  const resetToken = user.getResetPasswordToken();
  console.log(`Token: ${resetToken}`);
  await user.save({ validateBeforeSave: false });

  // Create reset password URL
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  const message = `
        You are receiving this email because you (or someone else) has requested the reset of a password.
        
        Please click on the following link to reset your password:
        
        ${resetUrl}
        
        This link will expire in 15 minutes.
        
        If you did not request this, please ignore this email and your password will remain unchanged.
    `;

  try {
    await sendEmail({
      email: user.email,
      subject: "LocalReviews - Password Reset",
      message,
    });

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorHandler("Email could not be sent", 500));
  }
});

// Reset Password
export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return next(
      new ErrorHandler("Please enter password and confirm password", 400)
    );
  }

  if (password !== confirmPassword) {
    return next(new ErrorHandler("Passwords do not match", 400));
  }

  // Hash token
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // Find user with this token
  let user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    user = await Provider.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });
  }

  if (!user) {
    return next(
      new ErrorHandler("Password reset token is invalid or has expired", 400)
    );
  }

  // Set new password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// Change Password
export const changePassword = catchAsyncError(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return next(new ErrorHandler("Please enter all required fields", 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new ErrorHandler("New passwords do not match", 400));
  }

  // Get user with password
  let user = await User.findById(req.user.id).select("+password");
  if (!user) {
    user = await Provider.findById(req.user.id).select("+password");
  }

  // Check previous password
  const isMatched = await user.comparePassword(oldPassword);
  if (!isMatched) {
    return next(new ErrorHandler("Old password is incorrect", 400));
  }

  user.password = newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

//verify phone otp
export const sendPhoneOTP = catchAsyncError(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone) {
    return next(new ErrorHandler("Please provide phone number", 400));
  }

  let user = req.user;
  if (phone !== user.phone) {
    return next(
      new ErrorHandler("Phone number does not match your profile", 400)
    );
  }

  // Generate OTP
  const otp = generateOTP(); // This generates a 6-digit number
  const hashedOTP = crypto
    .createHash("sha256")
    .update(String(otp))
    .digest("hex");

  user.phoneVerificationOTP = hashedOTP;
  user.phoneVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  const message = `Your LocalHands OTP is: ${otp}. It will expire in 10 minutes.`;

  try {
    await sendSMS(phone, message);
    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Verify Phone OTP
export const verifyPhoneOTP = catchAsyncError(async (req, res, next) => {
  const { otp } = req.body;

  if (!otp) {
    return next(new ErrorHandler("Please provide OTP", 400));
  }

  // Hash OTP
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

  let user = req.user;

  if (
    user.phoneVerificationOTP !== hashedOTP ||
    user.phoneVerificationExpire < Date.now()
  ) {
    return next(new ErrorHandler("Invalid or expired OTP", 400));
  }

  // Verify phone
  user.isPhoneVerified = true;
  user.phoneVerificationOTP = undefined;
  user.phoneVerificationExpire = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Phone verified successfully",
  });
});

//request phone update
export const requestPhoneUpdate = catchAsyncError(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone.match(/^[6-9]\d{9}$/)) {
    return next(new ErrorHandler("Invalid phone number", 400));
  }

  const otp = generateOTP();
  const hashedOTP = crypto
    .createHash("sha256")
    .update(String(otp))
    .digest("hex");

  const user = await User.findById(req.user.id);
  user.newPhoneNumber = phone;
  user.newPhoneOTP = hashedOTP;
  user.newPhoneOTPExpire = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  await sendSMS(phone, `Your verification OTP is: ${otp}`);

  res
    .status(200)
    .json({ success: true, message: "OTP sent to new phone number" });
});

// Verify OTP for phone update
export const verifyUpdatedPhoneOTP = catchAsyncError(async (req, res, next) => {
  const { otp } = req.body;

  if (!otp) {
    return next(new ErrorHandler("Please provide OTP", 400));
  }

  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
  const user = await User.findById(req.user.id);

  if (
    !user.newPhoneOTP ||
    user.newPhoneOTP !== hashedOTP ||
    user.newPhoneOTPExpire < Date.now()
  ) {
    return next(new ErrorHandler("Invalid or expired OTP", 400));
  }

  user.phone = user.newPhoneNumber;
  user.isPhoneVerified = true;
  user.newPhoneNumber = undefined;
  user.newPhoneOTP = undefined;
  user.newPhoneOTPExpire = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Phone number updated and verified successfully",
  });
});


//get profile
export const getMe = catchAsyncError(async (req, res, next) => {
  let user;
  
  if (req.user.role === "provider") {
    user = await Provider.findById(req.user.id)
      .populate("services.category")
      .populate("serviceAreas");
  } else {
    user = await User.findById(req.user.id);
  }
 
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }
  
  res.status(200).json({
    success: true,
    user,
  });
});


//update profile
export const updateProfile = catchAsyncError(async (req, res, next) => {
  const { name, address, preferences } = req.body;

  let user = await User.findById(req.user.id);
  if (!user) {
    user = await Provider.findById(req.user.id);
  }
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  if (name) user.name = name;
  if (address) user.address = address;
  if (preferences && req.user.role !== "provider") {
    user.preferences = { ...user.preferences, ...preferences };
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      address: user.address,
      role: user.role,
      ...(req.user.role !== "provider" && { preferences: user.preferences }),
    },
  });
});

//upload avatar
export const uploadAvatar = catchAsyncError(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorHandler("Please upload an image", 400));
  }

  let user = await User.findById(req.user.id);
  if (!user) {
    user = await Provider.findById(req.user.id);
  }

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Upload using buffer via stream
  const streamUpload = (buffer) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "avatars",
          width: 150,
          crop: "scale",
        },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      streamifier.createReadStream(buffer).pipe(stream);
    });
  };

  try {
    const result = await streamUpload(req.file.buffer);

    // Delete old avatar
    if (user.avatar.public_id !== "avatars/default_avatar") {
      await cloudinary.uploader.destroy(user.avatar.public_id);
    }

    user.avatar = {
      public_id: result.public_id,
      url: result.secure_url,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      avatar: user.avatar,
    });
  } catch (error) {
    console.error(error);
    return next(new ErrorHandler("Error uploading image", 500));
  }
});

//update profile just for provider
export const updateProviderProfile = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "provider") {
    return next(new ErrorHandler("Access denied", 403));
  }

  const {
    businessName,
    description,
    experience,
    services,
    serviceAreas,
    workingHours,
    bankDetails, 
  } = req.body;

  const provider = await Provider.findById(req.user.id);
  if (!provider) return next(new ErrorHandler("Provider not found", 404));

  if (businessName) provider.businessName = businessName;
  if (description) provider.description = description;
  if (experience !== undefined) provider.experience = experience;
  if (services && Array.isArray(services)) provider.services = services;
  if (serviceAreas && Array.isArray(serviceAreas))
    provider.serviceAreas = serviceAreas;
  if (workingHours && typeof workingHours === "object")
    provider.workingHours = workingHours;
  if (bankDetails && typeof bankDetails === "object")
    provider.bankDetails = bankDetails;

  await provider.save();

  res.status(200).json({
    success: true,
    message: "Provider profile updated successfully",
    provider: {
      id: provider._id,
      name: provider.name,
      email: provider.email,
      phone: provider.phone,
      businessName: provider.businessName,
      description: provider.description,
      experience: provider.experience,
      services: provider.services,
      serviceAreas: provider.serviceAreas,
      workingHours: provider.workingHours,
      ratings: provider.ratings,
      status: provider.status,
      avatar: provider.avatar,
    },
  });
});
