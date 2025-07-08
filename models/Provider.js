import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  SERVICE_CATEGORIES,
  SERVICE_SUBCATEGORIES,
} from "../utils/constants.js";

const providerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter your name"],
      maxLength: [50, "Name cannot exceed 50 characters"],
      minLength: [2, "Name should have more than 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Please enter your email"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please enter your password"],
      minLength: [6, "Password should be greater than 6 characters"],
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Please enter your phone number"],
      match: [/^[6-9]\d{9}$/, "Please enter a valid phone number"],
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    avatar: {
      public_id: {
        type: String,
        default: "avatars/default_avatar",
      },
      url: {
        type: String,
        default:
          "https://res.cloudinary.com/demo/image/upload/v1/avatars/default_avatar.png",
      },
    },
    role: {
      type: String,
      default: "provider",
      enum: ["provider"],
    },
    businessName: {
      type: String,
      required: [false, "Please enter your business name"],
    },
    description: {
      type: String,
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    experience: {
      type: Number,
      required: [true, "Please enter years of experience"],
      min: [0, "Experience cannot be negative"],
    },
    services: [
      {
        category: {
          type: String,
          required: true,
          enum: SERVICE_CATEGORIES,
        },
        subcategory: {
          type: String,
          required: true,
          validate: {
            validator: function (v) {
              const selectedCategory = this.category;
              if (selectedCategory && SERVICE_SUBCATEGORIES[selectedCategory]) {
                // Check if the subcategory name exists in the array of objects
                return SERVICE_SUBCATEGORIES[selectedCategory].some(
                  (sub) => sub.name === v
                );
              }
              return false;
            },
            message: (props) =>
              `${props.value} is not a valid subcategory for the selected category!`,
          },
        },
        price: {
          type: Number,
          required: true,
          min: [0, "Price cannot be negative"],
        },
        unit: {
          type: String,
          enum: [
            "per job",
            "1 sqft",
            "1 room",
            "1 hour",
            "1 day",
            "per day",
            "per task",
          ], // <<< CHANGE HERE: Added "1 day", "per day", "per task"
          default: "per job",
        },
        description: String,
      },
    ],
    serviceAreas: [
      {
        city: String,
        pincodes: [String],
      },
    ],
    workingHours: {
      monday: { start: String, end: String, available: Boolean },
      tuesday: { start: String, end: String, available: Boolean },
      wednesday: { start: String, end: String, available: Boolean },
      thursday: { start: String, end: String, available: Boolean },
      friday: { start: String, end: String, available: Boolean },
      saturday: { start: String, end: String, available: Boolean },
      sunday: { start: String, end: String, available: Boolean },
    },
    portfolio: [
      {
        title: String,
        description: String,
        images: [
          {
            public_id: String,
            url: String,
          },
        ],
        completedAt: Date,
      },
    ],
    kyc: {
      aadharNumber: {
        type: String,
        match: [
          /^[2-9]{1}[0-9]{3}[0-9]{4}[0-9]{4}$/,
          "Please enter a valid Aadhar number",
        ],
      },
      panNumber: {
        type: String,
        match: [
          /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
          "Please enter a valid PAN number",
        ],
      },
      aadharImage: {
        public_id: String,
        url: String,
      },
      panImage: {
        public_id: String,
        url: String,
      },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      verifiedAt: Date,
      rejectionReason: String,
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: [0, "Rating cannot be negative"],
        max: [5, "Rating cannot exceed 5"],
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected", "suspended"],
      default: "pending",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    completedJobs: {
      type: Number,
      default: 0,
    },
    earnings: {
      total: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      withdrawn: { type: Number, default: 0 },
    },
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String,
    },
    lastLogin: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    suspensionReason: {
      type: String,
      maxLength: 500,
    },
    suspendedAt: {
      type: Date,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    phoneVerificationOTP: String,
    phoneVerificationExpire: Date,

    newPhoneNumber: {
      type: String,
      match: [/^[6-9]\d{9}$/, "Please enter a valid phone number"],
    },
    newPhoneOTP: String,
    newPhoneOTPExpire: Date,
  },
  {
    timestamps: true,
  }
);

providerSchema.index({ location: "2dsphere" });

// Encrypt password before saving
providerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
providerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
providerSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Generate password reset token
providerSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

// Generate email verification token
providerSchema.methods.getEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(20).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Generate phone verification OTP
providerSchema.methods.generatePhoneOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  this.phoneVerificationOTP = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  this.phoneVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return otp;
};

export const Provider = mongoose.model("Provider", providerSchema);
