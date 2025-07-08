import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter service name"],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Please select a category"],
    },
    subcategory: {
      type: String,
      required: [true, "Please enter subcategory"],
      validate: {
        validator: async function(v) {
          if (!this.category) return false;
          const categoryDoc = await mongoose.model('Category').findById(this.category);
          if (categoryDoc && categoryDoc.subcategories.some(sub => sub.name === v)) {
            return true;
          }
          return false;
        },
        message: props => `${props.value} is not a valid subcategory for the selected category!`,
      },
    },
    description: {
      type: String,
      required: [true, "Please enter service description"],
    },
    icon: {
      public_id: String,
      url: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    averagePrice: {
      min: Number,
      max: Number,
      unit: {
        type: String,
        enum: ["hour", "job", "sqft", "room", "day", "task"],
        default: "job",
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Service = mongoose.model("Service", serviceSchema);