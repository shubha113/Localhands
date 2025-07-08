import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.ObjectId,
      refPath: "reporterType",
      required: true,
    },
    reporterType: {
      type: String,
      enum: ["User", "Provider"],
      required: true,
    },
    reported: {
      type: mongoose.Schema.ObjectId,
      refPath: "reportedType",
      required: true,
    },
    reportedType: {
      type: String,
      enum: ["User", "Provider", "Review"],
      required: true,
    },
    booking: {
      type: mongoose.Schema.ObjectId,
      ref: "Booking",
    },
    reason: {
      type: String,
      required: [true, "Please provide a reason for reporting"],
      enum: [
        "inappropriate_behavior",
        "fake_profile",
        "poor_service",
        "payment_issue",
        "no_show",
        "harassment",
        "fake_review",
        "spam",
        "other",
      ],
    },
    description: {
      type: String,
      required: [true, "Please provide detailed description"],
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    evidence: [
      {
        public_id: String,
        url: String,
        description: String,
      },
    ],
    status: {
      type: String,
      enum: ["pending", "investigating", "resolved", "dismissed"],
      default: "pending",
    },
    adminNotes: String,
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    action: {
      type: String,
      enum: ["warning", "suspension", "ban", "no_action"],
      description: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Report = new mongoose.model("Report", reportSchema);
