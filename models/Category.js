import mongoose from "mongoose";
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter category name"],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: [true, "Please enter category description"],
  },
  icon: {
    public_id: String,
    url: String,
  },
  subcategories: [
    {
      name: {
        type: String,
        required: true,
      },
      description: String,
      averagePrice: {
        min: Number,
        max: Number,
        unit: {
          type: String,
          enum: ["hour", "job", "sqft", "room", "day", "task"],
          default: "job",
        },
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  providerCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export const Category = mongoose.model("Category", categorySchema);