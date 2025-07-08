import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    booking:{
        type: mongoose.Schema.ObjectId,
        ref: "Booking",
        required: true
    },
    user:{
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true,
    },
    provider:{
        type: mongoose.Schema.ObjectId,
        ref: "Provider",
        required: true
    },
    razorpayOrderId:{
        type: String,
        required: true
    },
    razorpayPaymentId: String,
    razorpaySignature: String,
    amount:{
        type: Number,
        required: true
    },
    currency:{
        type: String,
        default: "INR"
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: String,
    plateformFee:{
        type: Number,
        required: true
    },
    providerAmmount:{
        type: Number,
        required: true,
    },
    commision:{
        type: Number,
        reuired: true
    },
    refund:{
        razorpayRefundId: String,
        amount: Number,
        reason: String,
        status: {
            type: String,
            enum: ['pending', 'processed', 'failed']
        },
        processedAt: Date
    },
    payout: {
        razorpayPayoutId: String,
        amount: Number,
        status: {
            type: String,
            enum: ['pending', 'processed', 'failed']
        },
        processedAt: Date,
        accountDetails: {
            accountNumber: String,
            ifsc: String
        }
    },
    metadata: {
        userAgent: String,
        ipAddress: String
    }
}, {
    timestamps: true
});

// Index for efficient queries
paymentSchema.index({ booking: 1 });
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ provider: 1, status: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ createdAt: -1 });

export const Payment = new mongoose.model('Payment', paymentSchema);