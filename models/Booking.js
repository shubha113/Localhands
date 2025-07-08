import mongoose from 'mongoose';
import { SERVICE_CATEGORIES, SERVICE_SUBCATEGORIES } from '../utils/constants.js';

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: mongoose.Schema.ObjectId,
    ref: 'Provider',
    required: true
  },
  service: {
    category: {
      type: String,
      required: true,
      enum: SERVICE_CATEGORIES,
    },
    subcategory: {
  type: String,
  required: true,
  validate: {
    validator: function(v) {
      const selectedCategory = this.service.category;
      if (selectedCategory && SERVICE_SUBCATEGORIES[selectedCategory]) {
        return SERVICE_SUBCATEGORIES[selectedCategory].some(sub => sub.name === v);
      }
      return false;
    },
    message: props => `${props.value} is not a valid subcategory for the selected category in booking!`,
  },
}
  },
  scheduledDateTime: {
    type: Date,
    required: [true, 'Please select date and time']
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    landmark: String
  },
  pricing: {
    basePrice: {
      type: Number,
      required: true
    },
    additionalCharges: [{
      description: String,
      amount: Number
    }],
    discount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    platformFee: {
      type: Number,
      required: true
    },
    providerAmount: {
      type: Number,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'expired'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  images: [{
    public_id: String,
    url: String,
    description: String
  }],
  notes: {
    user: String,
    provider: String,
    admin: String
  },
  timeline: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  cancellation: {
    cancelledBy: {
      type: String,
      enum: ['user', 'provider', 'admin']
    },
    reason: String,
    cancelledAt: Date,
    refundAmount: Number
  },
  completion: {
    completedAt: Date,
    workImages: [{
      public_id: String,
      url: String,
      description: String
    }],
    invoice: {
      public_id: String,
      url: String
    }
  },
   completionOTP: {
    otp: String, // Hashed OTP
    generatedAt: Date,
    expiresAt: Date,
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    isUsed: {
      type: Boolean,
      default: false
    }
  },
  expiresAt: {
    type: Date,
    default: function() {
      if(this.status === 'pending'){
        return new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      return undefined;
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ provider: 1, status: 1 });
bookingSchema.index({ scheduledDateTime: 1 });
bookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Booking = mongoose.model("Booking", bookingSchema);