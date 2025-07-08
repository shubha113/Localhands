import { Provider } from "../models/Provider.js";
import ErrorHandler from "../utils/errorHandler.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { calculateRefundAmount } from "../utils/payment.js";
import { Booking } from "../models/Booking.js";
import { Category } from "../models/Category.js";
import haversine from "haversine-distance";
import crypto from 'crypto';
import {
  sendBookingNotification,
} from "../utils/notification.js";
import { User } from "../models/User.js";
import { generateOTP, sendSMS } from '../utils/sendSms.js';

// Create booking
export const createBooking = catchAsyncError(async (req, res, next) => {
  const { providerId, scheduledDateTime, address, pricing, images, notes } = req.body;
  const { category, subcategory } = req.body.service || {};

  if (!category || !subcategory) {
    return next(new ErrorHandler("Category and subcategory are required in service", 400));
  }

  const user = await User.findById(req.user.id);
  if (
    !user ||
    !user.address?.coordinates?.latitude ||
    !user.address?.coordinates?.longitude
  ) {
    return next(
      new ErrorHandler(
        "User location not found. Please update your profile with location.",
        400
      )
    );
  }

  const userLat = user.address.coordinates.longitude;
  const userLng = user.address.coordinates.latitude;

  const provider = await Provider.findById(providerId);
  if (!provider) {
    return next(new ErrorHandler("Provider not found", 404));
  }

  if (!provider.isAvailable || !provider.isActive) {
    return next(new ErrorHandler("Provider is currently unavailable", 400));
  }

  const distanceMeters = haversine(
    { lat: userLat, lon: userLng },
    { lat: provider.location.coordinates[1], lon: provider.location.coordinates[0] }
  );
  if (distanceMeters > 10000) {
    return next(new ErrorHandler("Provider is outside 10km radius. Cannot book.", 400));
  }

  const scheduledTime = new Date(scheduledDateTime);
  const now = new Date();
  if (scheduledTime <= now) {
    return next(new ErrorHandler("Scheduled time must be in the future", 400));
  }

  const daysMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayOfWeek = daysMap[scheduledTime.getDay()];
  const workingHours = provider.workingHours?.[dayOfWeek];

  if (!workingHours || !workingHours.available) {
    return next(new ErrorHandler(`Provider is not available on ${dayOfWeek}`, 400));
  }

  // Check if scheduled time falls within working hours
  const [startHour, startMinute] = workingHours.start.split(":").map(Number);
  const [endHour, endMinute] = workingHours.end.split(":").map(Number);

  const startTime = new Date(scheduledTime);
  startTime.setHours(startHour, startMinute, 0, 0);

  const endTime = new Date(scheduledTime);
  endTime.setHours(endHour, endMinute, 0, 0);

  if (scheduledTime < startTime || scheduledTime > endTime) {
    return next(
      new ErrorHandler(
        `Provider is only available between ${workingHours.start} and ${workingHours.end} on ${dayOfWeek}`,
        400
      )
    );
  }

  const conflictBuffer = 2 * 60 * 60 * 1000; // 2 hours in ms
  const conflictingBooking = await Booking.findOne({
    provider: providerId,
    scheduledDateTime: {
      $gte: new Date(scheduledTime.getTime() - conflictBuffer),
      $lte: new Date(scheduledTime.getTime() + conflictBuffer)
    },
    status: { $in: ["accepted", "in_progress"] }
  });

  if (conflictingBooking) {
    return next(new ErrorHandler("Provider is not available at this time", 400));
  }

  const booking = await Booking.create({
    user: req.user.id,
    provider: providerId,
    service: { category, subcategory },
    scheduledDateTime,
    address,
    pricing,
    images: images || [],
    notes: { user: notes || "" },
    timeline: [{ status: "pending", note: "Booking created" }]
  });

  await booking.populate([
    { path: "user", select: "name email phone" },
    { path: "provider", select: "name businessName phone avatar ratings" }
  ]);

  res.status(201).json({
    success: true,
    message: "Booking created successfully",
    booking
  });
});

//provider accepts booking
export const acceptBooking = catchAsyncError(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id).populate([
    { path: "user", select: "name email phone preferences" },
    { path: "provider", select: "name businessName phone" },
  ]);

  if (!booking) {
    return next(new ErrorHandler("Booking not found", 404));
  }

  if (booking.provider.id.toString() !== req.user.id) {
    return next(new ErrorHandler("Not authorized to access this booking", 403));
  }

  if (booking.status !== "pending") {
    return next(
      new ErrorHandler("Booking cannot be accepted in current status", 400)
    );
  }

  // Check if booking has expired
  if (booking.expiresAt < new Date()) {
    booking.status = "expired";
    await booking.save();
    return next(new ErrorHandler("Booking has expired", 400));
  }

  booking.status = "accepted";
  booking.timeline.push({
    status: "accepted",
    note: "Booking accepted by provider",
  });

  await booking.save();

  await sendBookingNotification("booking_accepted", {
    booking,
    user: booking.user,
    provider: booking.provider,
  });

  await booking.populate([
    { path: "user", select: "name email phone" },
    { path: "provider", select: "name businessName phone" },
  ]);

  res.status(200).json({
    success: true,
    message: "Booking accepted successfully",
    booking,
  });
});

//reject booking
export const rejectBooking = catchAsyncError(async (req, res, next) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id).populate([
    { path: "user", select: "name email phone preferences" },
    { path: "provider", select: "name businessName phone" },
  ]);

  if (!booking) {
    return next(new ErrorHandler("Booking not found", 404));
  }

  if (booking.provider._id.toString() !== req.user.id) {
    return next(new ErrorHandler("Not authorized to access this booking", 403));
  }

  if (booking.status !== "pending") {
    return next(
      new ErrorHandler("Booking cannot be rejected in current status", 400)
    );
  }

  if (booking.expiresAt < new Date()) {
    booking.status = "expired";
    await booking.save();
    return next(new ErrorHandler("Booking has already expired", 400));
  }

  const trimmedReason = (reason || "Rejected by provider").trim();

  booking.status = "cancelled";
  booking.cancellation = {
    cancelledBy: "provider",
    reason: trimmedReason,
    cancelledAt: new Date(),
  };
  booking.timeline.push({
    status: "cancelled",
    note: `Rejected by provider: ${trimmedReason}`,
  });

  await booking.save();

  // Send notification to user about booking rejection
  await sendBookingNotification("booking_rejected", {
    booking,
    user: booking.user,
    provider: booking.provider,
  });

  await booking.populate([
    { path: "user", select: "name email phone" },
    { path: "provider", select: "name businessName phone" },
  ]);

  res.status(200).json({
    success: true,
    message: "Booking rejected successfully",
    booking,
  });
});



// Generate OTP for booking completion
export const generateCompletionOTP = catchAsyncError(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id).populate([
    { path: "user", select: "name email phone preferences" },
    { path: "provider", select: "name businessName phone" },
  ]);

  if (!booking) {
    return next(new ErrorHandler("Booking not found", 404));
  }

  // Check if provider is authorized
  if (booking.provider._id.toString() !== req.user.id) {
    return next(new ErrorHandler("Not authorized to access this booking", 403));
  }

  // Check booking status
  if (booking.status !== "in_progress") {
    return next(new ErrorHandler("Booking must be in progress to generate completion OTP", 400));
  }

  if (booking.status === "completed") {
    return next(new ErrorHandler("Booking is already completed", 400));
  }

  // Check if OTP was recently generated (prevent spam)
  if (booking.completionOTP && booking.completionOTP.generatedAt) {
    const timeSinceLastOTP = Date.now() - booking.completionOTP.generatedAt.getTime();
    const minWaitTime = 2 * 60 * 1000; // 2 minutes

    if (timeSinceLastOTP < minWaitTime) {
      const remainingTime = Math.ceil((minWaitTime - timeSinceLastOTP) / 1000);
      return next(new ErrorHandler(`Please wait ${remainingTime} seconds before requesting a new OTP`, 429));
    }
  }

  // Generate 6-digit OTP
  const otp = generateOTP().toString();
  
  // Create hashed version for storage
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

  // Set OTP expiration (10 minutes)
  const otpExpiration = new Date(Date.now() + 10 * 60 * 1000);

  // Update booking with OTP details
  booking.completionOTP = {
    otp: hashedOTP,
    generatedAt: new Date(),
    expiresAt: otpExpiration,
    attempts: 0,
    maxAttempts: 3,
    isUsed: false
  };

  await booking.save();

  // Send OTP to user's phone
  const message = `Your booking completion OTP is: ${otp}. This OTP is valid for 10 minutes. Share this OTP with Service Provider only if the Booking is complete. Service Provider: ${booking.provider.businessName || booking.provider.name}`;

  try {
    await sendSMS(booking.user.phone, message);
    
    booking.timeline.push({
      status: "otp_generated",
      note: "Completion OTP sent to user"
    });
    
    await booking.save();

    res.status(200).json({
      success: true,
      message: "OTP sent to user's phone number successfully",
      data: {
        otpSentTo: `*****${booking.user.phone.slice(-4)}`,
        expiresAt: otpExpiration
      }
    });

  } catch (error) {
    booking.completionOTP = undefined;
    await booking.save();
    
    console.error('SMS sending failed:', error);
    return next(new ErrorHandler(error.message || "Failed to send OTP", 500));
  }
});


// Complete booking  with otp
export const completeBookingWithOTP = catchAsyncError(async (req, res, next) => {
  const { workImages, notes, otp } = req.body;

  if (!otp) {
    return next(new ErrorHandler("OTP is required to complete the booking", 400));
  }

  const booking = await Booking.findById(req.params.id).populate([
    { path: "user", select: "name email phone preferences" },
    { path: "provider", select: "name businessName phone" },
  ]);

  if (!booking) {
    return next(new ErrorHandler("Booking not found", 404));
  }

  if (booking.provider._id.toString() !== req.user.id) {
    return next(new ErrorHandler("Not authorized to access this booking", 403));
  }

  if (booking.status === "completed") {
    return next(new ErrorHandler("Booking is already marked as completed", 400));
  }

  if (booking.status !== "in_progress") {
    return next(new ErrorHandler("Booking must be in progress to complete", 400));
  }

  if (!booking.completionOTP || !booking.completionOTP.otp) {
    return next(new ErrorHandler("No OTP generated for this booking. Please generate OTP first", 400));
  }

  if (booking.completionOTP.isUsed) {
    return next(new ErrorHandler("OTP has already been used", 400));
  }

  if (booking.completionOTP.expiresAt < new Date()) {
    return next(new ErrorHandler("OTP has expired. Please generate a new OTP", 400));
  }

  if (booking.completionOTP.attempts >= booking.completionOTP.maxAttempts) {
    return next(new ErrorHandler("Maximum OTP attempts exceeded. Please generate a new OTP", 400));
  }

  const hashedEnteredOTP = crypto.createHash('sha256').update(otp.toString()).digest('hex');
  
  booking.completionOTP.attempts += 1;

  if (hashedEnteredOTP !== booking.completionOTP.otp) {
    await booking.save();
    
    const remainingAttempts = booking.completionOTP.maxAttempts - booking.completionOTP.attempts;
    
    if (remainingAttempts > 0) {
      return next(new ErrorHandler(`Invalid OTP. ${remainingAttempts} attempts remaining`, 400));
    } else {
      return next(new ErrorHandler("Invalid OTP. Maximum attempts exceeded. Please generate a new OTP", 400));
    }
  }

  if (workImages && !Array.isArray(workImages)) {
    return next(new ErrorHandler("workImages must be an array", 400));
  }

  booking.status = "completed";
  booking.completion = {
    completedAt: new Date(),
    workImages: workImages || [],
  };

  booking.completionOTP.isUsed = true;

  booking.timeline.push({
    status: "completed",
    note: "Work completed by provider and verified by user via OTP",
  });

  if (notes) {
    booking.notes.provider = notes;
  }

  await booking.save();

  await Provider.findByIdAndUpdate(booking.provider._id, {
    $inc: { completedJobs: 1 },
  });

  // Send notification
  try {
    await sendBookingNotification("booking_completed", {
      booking,
      user: booking.user,
      provider: booking.provider,
    });
  } catch (notificationError) {
    console.error('Notification sending failed:', notificationError);
  }

  res.status(200).json({
    success: true,
    message: "Booking completed successfully with OTP verification",
    booking,
  });
});

// Cancel booking
export const cancelBooking = catchAsyncError(async (req, res, next) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new ErrorHandler("Booking not found", 404));
  }

  const isUser = booking.user.toString() === req.user.id;
  const isProvider = booking.provider.toString() === req.user.id;
  const isAdmin = req.user.role === "admin";

  if (!isUser && !isProvider && !isAdmin) {
    return next(new ErrorHandler("Not authorized to cancel this booking", 403));
  }

  if (["completed", "cancelled"].includes(booking.status)) {
    return next(
      new ErrorHandler("Cannot cancel booking in current status", 400)
    );
  }

  const refundAmount = calculateRefundAmount(booking);

  booking.status = "cancelled";
  booking.cancellation = {
    cancelledBy: isUser ? "user" : isProvider ? "provider" : "admin",
    reason: reason || "Cancelled",
    cancelledAt: new Date(),
    refundAmount,
  };

  booking.timeline.push({
    status: "cancelled",
    note: `Cancelled by ${
      isUser ? "user" : isProvider ? "provider" : "admin"
    }: ${reason || "No reason provided"}`,
  });

  await booking.save();

   // Send notification to user about booking rejection
  await sendBookingNotification("booking_rejected", {
    booking,
    user: booking.user,
    provider: booking.provider,
  });


  res.status(200).json({
    success: true,
    message: "Booking cancelled successfully",
    booking,
    refundAmount,
  });
});


// Get single booking details
export const getBookingDetails = catchAsyncError(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id)
    .populate("user", "name email phone avatar address")
    .populate("provider", "name businessName email phone avatar ratings location");

  if (!booking) {
    return next(new ErrorHandler("Booking not found", 404));
  }

  const isUser = booking.user._id.toString() === req.user.id;
  const isProvider = booking.provider._id.toString() === req.user.id;
  const isAdmin = req.user.role === "admin";

  if (!isUser && !isProvider && !isAdmin) {
    return next(new ErrorHandler("Not authorized to access this booking", 403));
  }

  res.status(200).json({
    success: true,
    booking: {
      _id: booking._id,
      scheduledDateTime: booking.scheduledDateTime,
      service: booking.service,
      pricing: booking.pricing,
      address: booking.address,
      images: booking.images,
      notes: booking.notes,
      timeline: booking.timeline,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      user: booking.user,
      provider: booking.provider,
    },
  });
});


// Get all bookings for the logged-in user or provider
export const getMyBookings = catchAsyncError(async (req, res, next) => {
  let query = {};

  // Determine whether user is customer or provider
  if (req.user.role === "user") {
    query.user = req.user.id;
  } else if (req.user.role === "provider") {
    query.provider = req.user.id;
  } else {
    return next(new ErrorHandler("Unauthorized to view bookings", 403));
  }

  // Optional: allow filtering by status (e.g., ?status=completed)
  if (req.query.status) {
    query.status = req.query.status;
  }

  const bookings = await Booking.find(query)
    .sort({ createdAt: -1 }) // newest first
    .populate("user", "name email phone avatar address")
    .populate("provider", "name businessName email phone avatar ratings location");

  const detailedBookings = bookings.map(booking => ({
    _id: booking._id,
    scheduledDateTime: booking.scheduledDateTime,
    service: booking.service,
    pricing: booking.pricing,
    address: booking.address,
    images: booking.images,
    notes: booking.notes,
    timeline: booking.timeline,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    cancellation: booking.cancellation,
    completion: booking.completion,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    user: booking.user,
    provider: booking.provider,
  }));

  res.status(200).json({
    success: true,
    total: detailedBookings.length,
    bookings: detailedBookings,
  });
});



//reshedule booking
export const rescheduleBooking = catchAsyncError(async (req, res, next) => {
  const { newDateTime } = req.body;

  // Populate the booking with user and provider details for notifications
  const booking = await Booking.findById(req.params.id).populate([
    { path: "user", select: "name email phone preferences" },
    { path: "provider", select: "name businessName phone" },
  ]);

  if (!booking) {
    return next(new ErrorHandler("Booking not found", 404));
  }

  const isUser = booking.user._id.toString() === req.user.id;
  const isProvider = booking.provider._id.toString() === req.user.id;

  if (!isUser && !isProvider) {
    return next(
      new ErrorHandler("Not authorized to reschedule this booking", 403)
    );
  }

  if (!["pending", "accepted"].includes(booking.status)) {
    return next(
      new ErrorHandler("Cannot reschedule booking in current status", 400)
    );
  }

  const newTime = new Date(newDateTime);
  const minAllowedTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
  if (newTime <= minAllowedTime) {
    return next(
      new ErrorHandler("New time must be at least 2 hours from now", 400)
    );
  }

  const category = await Category.findOne({ name: booking.service.category });
  if (!category) {
    return next(new ErrorHandler("Service category not found", 404));
  }

  const subcategoryData = category.subcategories.find(
    (sub) => sub.name === booking.service.subcategory
  );

  if (!subcategoryData) {
    return next(new ErrorHandler("Service subcategory not found", 404));
  }

  let durationHours = 1;

  switch (subcategoryData.averagePrice?.unit) {
    case "hour":
      durationHours = 1;
      break;
    case "job":
    case "sqft":
    case "room":
      durationHours = 1;
      break;
    default:
      durationHours = 1;
  }

  const conflictingBooking = await Booking.findOne({
    provider: booking.provider._id,
    _id: { $ne: booking._id },
    status: { $in: ["accepted", "in_progress"] },
    scheduledDateTime: {
      $gte: new Date(newTime.getTime() - durationHours * 60 * 60 * 1000),
      $lte: new Date(newTime.getTime() + durationHours * 60 * 60 * 1000),
    },
  });

  if (conflictingBooking) {
    return next(
      new ErrorHandler("Provider is not available at the new time", 400)
    );
  }

  const oldTime = booking.scheduledDateTime;
  booking.scheduledDateTime = newTime;

  const rescheduledBy = isUser ? "user" : "provider";
  const reschedulerName = isUser ? booking.user.name : booking.provider.businessName;

  booking.timeline.push({
    status: "rescheduled",
    note: `Booking rescheduled by ${reschedulerName} from ${oldTime.toLocaleString()} to ${newTime.toLocaleString()}`,
    rescheduledBy,
  });

  await booking.save();

  // Send notification to the OTHER party (not the one who rescheduled)
    if (isUser) {
      // User rescheduled, notify provider
      await sendBookingNotification("booking_rescheduled_by_user", {
        booking,
        user: booking.user,
        provider: booking.provider,
        oldDateTime: oldTime,
        newDateTime: newTime,
      });
    } else {
      // Provider rescheduled, notify user
      await sendBookingNotification("booking_rescheduled_by_provider", {
        booking,
        user: booking.user,
        provider: booking.provider,
        oldDateTime: oldTime,
        newDateTime: newTime,
      });
    }

  res.status(200).json({
    success: true,
    message: "Booking rescheduled successfully",
    booking,
  });
});