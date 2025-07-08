import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: mongoose.Schema.ObjectId,
      ref: "Provider",
      required: true,
    },
    booking: {
      type: mongoose.Schema.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    rating: {
      type: Number,
      required: [true, "Please provide a rating"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    title: {
      type: String,
      required: [true, "Please provide a review title"],
      maxLength: [100, "Title cannot exceed 100 characters"],
    },
    comment: {
      type: String,
      required: [true, "Please provide a review comment"],
      maxLength: [500, "Comment cannot exceed 500 characters"],
    },
    images: [
      {
        public_id: String,
        url: String,
      },
    ],
    aspects: {
      punctuality: {
        type: Number,
        min: 1,
        max: 5,
      },
      quality: {
        type: Number,
        min: 1,
        max: 5,
      },
      communication: {
        type: Number,
        min: 1,
        max: 5,
      },
      value: {
        type: Number,
        min: 1,
        max: 5,
      },
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    reportStatus: {
      type: String,
      enum: ["pending", "reviewed", "dismissed"],
      default: "pending",
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    response: {
      comment: String,
      respondedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ provider: 1, rating: -1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ createdAt: -1 });

export const Review = new mongoose.model("Review", reviewSchema);
