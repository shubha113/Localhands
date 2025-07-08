import Razorpay from 'razorpay';
import crypto from 'crypto';

export const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_API_SECRET
});

export const verifyRazorpaySignature = ({orderId, paymentId, signature})=>{
    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto.
    createHmac("sha256", process.env.RAZORPAY_API_SECRET)
    .update(body)
    .digest('hex')

    return expectedSignature === signature
};


export const calculateRefundAmount = (booking) => {
  const timeUntilScheduled = booking.scheduledDateTime - new Date();

  if (booking.paymentStatus !== 'paid') return 0;

  if (timeUntilScheduled > 24 * 60 * 60 * 1000) {
    return booking.pricing.totalAmount;
  } else if (timeUntilScheduled > 2 * 60 * 60 * 1000) {
    return booking.pricing.totalAmount * 0.5;
  } else {
    return 0;
  }
};
