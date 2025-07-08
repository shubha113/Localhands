import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { Booking } from "../models/Booking.js";
import { Payment } from "../models/Payment.js";
import { Provider } from "../models/Provider.js";
import ErrorHandler from "../utils/errorHandler.js";
import {razorpayInstance, verifyRazorpaySignature} from '../utils/payment.js'

//create payment
export const createPayment = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId).populate("user provider");
  
  if (!booking) return next(new ErrorHandler("Booking not found", 404));

if (booking.user._id.toString() !== req.user.id) {
  return next(new ErrorHandler("Not authorized to pay for this booking", 403));
}


  if (booking.status !== "accepted") {
    return next(new ErrorHandler("Only accepted bookings can proceed to payment", 400));
  }

  const amount = booking.pricing.totalAmount * 100; // Convert to paisa
  const options = {
    amount,
    currency: "INR",
    receipt: `receipt_${booking._id}`,
  };

  const order = await razorpayInstance.orders.create(options);

  res.status(200).json({
    success: true,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
  });
});


//verify payment
export const verifyPayment = catchAsyncError(async (req, res, next) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    bookingId,
    paymentMethod,
    metadata,
  } = req.body;

  const booking = await Booking.findById(bookingId).populate("user provider");
  if (!booking) return next(new ErrorHandler("Booking not found", 404));
  
  if (!booking) return next(new ErrorHandler("Booking not found", 404));

  const isValid = verifyRazorpaySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!isValid) {
    return next(new ErrorHandler("Invalid payment signature", 400));
  }

  const totalAmount = booking.pricing.totalAmount;
  const platformFee = booking.pricing.platformFee;
  const providerAmount = booking.pricing.providerAmount;

  let payment = await Payment.create({
    booking: booking._id,
    user: booking.user._id,
    provider: booking.provider._id,
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    amount: totalAmount,
    status: "success",
    paymentMethod: paymentMethod || "online",
    plateformFee: platformFee,
    providerAmmount: providerAmount,
    commision: platformFee,
    metadata,
  });

  booking.paymentStatus = "paid";
  booking.status = "in_progress";
  booking.timeline.push({
    status: "paid",
    note: "Payment verified and recorded",
  });

  await booking.save();

  res.status(201).json({
    success: true,
    message: "Payment verified and recorded successfully",
    paymentId: payment._id,
  });
});


//refund payment
export const refundPayment = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) return next(new ErrorHandler("Booking not found", 404));

  if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'refunded') {
    return next(new ErrorHandler("No eligible payment to refund", 400));
  }

  if (!booking.cancellation || typeof booking.cancellation.refundAmount !== 'number') {
    return next(new ErrorHandler("Refund amount not found in cancellation", 400));
  }

  const payment = await Payment.findOne({ booking: bookingId });
  if (!payment || !payment.razorpayPaymentId) {
    return next(new ErrorHandler("Payment record not found for booking", 404));
  }

  // Check if refund is already processed
  if (payment.refund && payment.refund.status === 'processed') {
    return res.status(200).json({
      success: true,
      message: 'Refund already processed',
      refund: payment.refund
    });
  }

  // Initiate refund through Razorpay
  const razorpayRefund = await razorpayInstance.payments.refund(payment.razorpayPaymentId, {
    amount: booking.cancellation.refundAmount * 100, // Refund amount in paisa
    speed: "optimum"
  });

  // Update payment record
  payment.status = 'refunded';
  payment.refund = {
    razorpayRefundId: razorpayRefund.id,
    amount: booking.cancellation.refundAmount,
    reason: booking.cancellation.reason || 'Refund after cancellation',
    status: 'processed',
    processedAt: new Date()
  };
  await payment.save();

  booking.paymentStatus = 'refunded';
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Refund processed successfully",
    refund: payment.refund
  });
});

