import streamifier from "streamifier";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { Category } from "../models/Category.js";
import { Service } from "../models/Service.js";
import ErrorHandler from "../utils/errorHandler.js";
import cloudinary from "../utils/cloudinary.js";
import mongoose from "mongoose";
import { Provider } from "../models/Provider.js";
import { Review } from "../models/Review.js";
import { Booking } from "../models/Booking.js";
import { SERVICE_CATEGORIES, SERVICE_SUBCATEGORIES } from "../utils/constants.js";

// ADMIN ONLY ROUTES
// Create new category (Admin only)
export const createCategory = catchAsyncError(async (req, res, next) => {
  const { name, description, sortOrder } = req.body;

  const existing = await Category.findOne({ name });
  if (existing) {
    return next(new ErrorHandler("Category already exists", 400));
  }

  if (!req.file) {
    return next(new ErrorHandler("Please upload a category icon", 400));
  }

  // Upload to Cloudinary using stream
  const streamUpload = (buffer) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "category_icons",
        },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      streamifier.createReadStream(buffer).pipe(stream);
    });
  };

  const result = await streamUpload(req.file.buffer);

  const category = await Category.create({
    name,
    description,
    sortOrder,
    icon: {
      public_id: result.public_id,
      url: result.secure_url,
    },
  });

  res.status(201).json({
    success: true,
    category,
  });
});

//update category
export const updateCategory = catchAsyncError(async (req, res, next) => {
  let category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorHandler("Category not found", 404));
  }

  const { name, description, sortOrder } = req.body;

  if (name && name !== category.name) {
    const existing = await Category.findOne({ name });
    if (existing) {
      return next(new ErrorHandler("Category name already exists", 400));
    }
  }

  // Handle icon update
  if (req.file) {
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "category_icons",
          },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    const result = await streamUpload(req.file.buffer);

    if (category.icon && category.icon.public_id) {
      await cloudinary.uploader.destroy(category.icon.public_id);
    }

    category.icon = {
      public_id: result.public_id,
      url: result.secure_url,
    };
  }

  if (name) category.name = name;
  if (description) category.description = description;
  if (sortOrder) category.sortOrder = sortOrder;

  await category.save();

  res.status(200).json({
    success: true,
    category,
  });
});

//delete category(admin)
export const deleteCategory = catchAsyncError(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorHandler("Category not found", 404));
  }

  const servicesUsingCategory = await Service.countDocuments({
    category: category._id,
    isActive: true,
  });

  if (servicesUsingCategory > 0) {
    return next(
      new ErrorHandler(
        `Cannot delete category. ${servicesUsingCategory} active services are using this category.`,
        400
      )
    );
  }

  if (category.icon && category.icon.public_id) {
    await cloudinary.uploader.destroy(category.icon.public_id);
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: "Category deleted successfully",
  });
});

//create service
export const createService = catchAsyncError(async (req, res, next) => {
  const { name, category, subcategory, description, averagePrice, isActive } =
    req.body;

  if (!name || !category || !subcategory || !description) {
    return next(
      new ErrorHandler(
        "Please provide name, category, subcategory, and description",
        400
      )
    );
  }

  if (!mongoose.Types.ObjectId.isValid(category)) {
    return next(new ErrorHandler("Invalid category ID", 400));
  }

  const categoryExists = await Category.findById(category);
  if (!categoryExists) {
    return next(new ErrorHandler("Category not found", 404));
  }

  const existing = await Service.findOne({ name, category });
  if (existing) {
    return next(
      new ErrorHandler(
        "Service with this name and category already exists",
        409
      )
    );
  }

  const service = await Service.create({
    name,
    category,
    subcategory,
    description,
    averagePrice,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({
    success: true,
    message: "Service created successfully",
    service,
  });
});

//update service
export const updateService = catchAsyncError(async (req, res, next) => {
  const { name, category } = req.body;
  const serviceId = req.params.id;

  const service = await Service.findById(serviceId);
  if (!service) {
    return next(new ErrorHandler("Service not found", 404));
  }

  if (category) {
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return next(new ErrorHandler("Invalid category ID", 400));
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return next(new ErrorHandler("Category not found", 404));
    }
  }

  if (name && category) {
    const existing = await Service.findOne({
      _id: { $ne: serviceId },
      name,
      category,
    });

    if (existing) {
      return next(
        new ErrorHandler(
          "Another service with this name and category already exists",
          409
        )
      );
    }
  }

  const updatedService = await Service.findByIdAndUpdate(serviceId, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Service updated successfully",
    service: updatedService,
  });
});

//delete service (admin only)
export const deleteService = catchAsyncError(async (req, res, next) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    return next(new ErrorHandler("Service not found", 404));
  }

  await service.deleteOne();

  res.status(200).json({
    success: true,
    message: `Service '${service.name}' deleted successfully`,
  });
});

//get all categories
export const getAllCategories = catchAsyncError(async (req, res, next) => {
  const { isActive } = req.query;

  const filter = {};
  if (isActive !== undefined) {
    filter.isActive = isActive === "true";
  } else {
    filter.isActive = true;
  }

  const categories = await Category.find(filter)
    .sort({ sortOrder: 1, name: 1 })
    .select("name description icon subcategories providerCount");
  res.status(200).json({
    success: true,
    count: categories.length,
    categories,
  });
});

//get single category
export const getCategory = catchAsyncError(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorHandler("Category not found", 404));
  }

  if (!category.isActive) {
    return next(new ErrorHandler("Category is not active", 400));
  }

  res.status(200).json({
    succes: true,
    category,
  });
});

// Get statistics for all service categories
export const getCategoryStats = catchAsyncError(async (req, res, next) => {
  const categoryStats = await Promise.all(
    SERVICE_CATEGORIES.map(async (category) => {
      // Get providers count for this category
      const providersCount = await Provider.countDocuments({
        "services.category": category,
        status: { $in: ["verified", "pending"] },
        isActive: true,
        isBanned: false,
      });

      // Get all providers in this category for rating calculation
      const providersInCategory = await Provider.find({
        "services.category": category,
        status: { $in: ["verified", "pending"] },
        isActive: true,
        isBanned: false,
      }).select("_id");

      const providerIds = providersInCategory.map((p) => p._id);

      // Initialize default values
      let totalReviews = 0;
      let averageRating = 0;
      let startingPrice = null;

      if (providerIds.length > 0) {
        // Count total reviews for this category
        totalReviews = await Review.countDocuments({
          provider: { $in: providerIds },
          isHidden: false,
        });

        // Calculate average rating
        if (totalReviews > 0) {
          const ratingAggregation = await Review.aggregate([
            {
              $match: {
                provider: { $in: providerIds },
                isHidden: false,
              },
            },
            {
              $group: {
                _id: null,
                avgRating: { $avg: "$rating" },
                totalRatings: { $sum: 1 },
              },
            },
          ]);

          if (ratingAggregation.length > 0) {
            averageRating =
              Math.round(ratingAggregation[0].avgRating * 10) / 10;
          }
        }

        // Get starting price for this category
        const priceAggregation = await Provider.aggregate([
          {
            $match: {
              "services.category": category,
              status: { $in: ["verified", "pending"] },
              isActive: true,
              isBanned: false,
            },
          },
          {
            $unwind: "$services",
          },
          {
            $match: {
              "services.category": category,
            },
          },
          {
            $group: {
              _id: null,
              minPrice: { $min: "$services.price" },
            },
          },
        ]);

        if (priceAggregation.length > 0) {
          startingPrice = priceAggregation[0].minPrice;
        }
      }

      // Calculate average response time (based on recent bookings)
      let avgResponseTime = "30 mins"; // default

      const responseTimeAggregation = await Booking.aggregate([
        {
          $match: {
            "service.category": category,
            status: { $in: ["accepted", "in_progress", "completed"] },
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            }, // Last 30 days
          },
        },
        {
          $lookup: {
            from: "providers", // Collection name is typically plural
            localField: "provider",
            foreignField: "_id",
            as: "providerData",
          },
        },
        {
          $unwind: "$providerData",
        },
        {
          $addFields: {
            // Find the first status update that shows acceptance
            acceptedTimeline: {
              $filter: {
                input: "$timeline",
                cond: { $eq: ["$$this.status", "accepted"] },
              },
            },
          },
        },
        {
          $addFields: {
            // Calculate response time from creation to acceptance
            responseTime: {
              $cond: {
                if: { $gt: [{ $size: "$acceptedTimeline" }, 0] },
                then: {
                  $divide: [
                    {
                      $subtract: [
                        { $arrayElemAt: ["$acceptedTimeline.timestamp", 0] },
                        "$createdAt",
                      ],
                    },
                    1000 * 60, // Convert to minutes
                  ],
                },
                else: {
                  // Fallback: use updatedAt - createdAt
                  $divide: [
                    { $subtract: ["$updatedAt", "$createdAt"] },
                    1000 * 60,
                  ],
                },
              },
            },
          },
        },
        {
          $match: {
            responseTime: { $gte: 0 }, // Only positive response times
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: "$responseTime" },
            count: { $sum: 1 },
          },
        },
      ]);

      if (
        responseTimeAggregation.length > 0 &&
        responseTimeAggregation[0].count > 0
      ) {
        const avgMinutes = Math.round(
          responseTimeAggregation[0].avgResponseTime
        );
        if (avgMinutes < 60) {
          avgResponseTime = `${avgMinutes} mins`;
        } else {
          const hours = Math.round(avgMinutes / 60);
          avgResponseTime = `${hours} ${hours === 1 ? "hour" : "hours"}`;
        }
      }

      return {
        category,
        rating: averageRating || 0,
        reviews: totalReviews || 0,
        providers: providersCount || 0,
        startingPrice: startingPrice || 0,
        responseTime: avgResponseTime,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: categoryStats,
  });
});


// Get statistics for all subcategories within a specific category
export const getSubCategoryStats = catchAsyncError(async (req, res, next) => {
  const { category } = req.params; // Get category from URL params

  // Validate if the category exists
  if (!SERVICE_CATEGORIES.includes(category)) {
    return next(new ErrorHandler("Invalid category", 400));
  }

  // Get subcategories for this category
  const subcategories = SERVICE_SUBCATEGORIES[category];

  if (!subcategories || subcategories.length === 0) {
    return res.status(200).json({
      success: true,
      data: [],
      message: "No subcategories found for this category",
    });
  }

  const subCategoryStats = await Promise.all(
    subcategories.map(async (subcategory) => {
      const { name, description } = subcategory;

      // Get providers count for this subcategory
      const providersCount = await Provider.countDocuments({
        "services.category": category,
        "services.subcategory": name,
        status: { $in: ["verified", "pending"] },
        isActive: true,
        isBanned: false,
      });

      // Get all providers in this subcategory for rating calculation
      const providersInSubCategory = await Provider.find({
        "services.category": category,
        "services.subcategory": name,
        status: { $in: ["verified", "pending"] },
        isActive: true,
        isBanned: false,
      }).select("_id");

      const providerIds = providersInSubCategory.map((p) => p._id);

      // Initialize default values
      let totalReviews = 0;
      let averageRating = 0;
      let startingPrice = null;

      if (providerIds.length > 0) {
        // Count total reviews for this subcategory
        totalReviews = await Review.countDocuments({
          provider: { $in: providerIds },
          isHidden: false,
        });

        // Calculate average rating
        if (totalReviews > 0) {
          const ratingAggregation = await Review.aggregate([
            {
              $match: {
                provider: { $in: providerIds },
                isHidden: false,
              },
            },
            {
              $group: {
                _id: null,
                avgRating: { $avg: "$rating" },
                totalRatings: { $sum: 1 },
              },
            },
          ]);

          if (ratingAggregation.length > 0) {
            averageRating = Math.round(ratingAggregation[0].avgRating * 10) / 10;
          }
        }

        // Get starting price for this subcategory
        const priceAggregation = await Provider.aggregate([
          {
            $match: {
              "services.category": category,
              "services.subcategory": name,
              status: { $in: ["verified", "pending"] },
              isActive: true,
              isBanned: false,
            },
          },
          { $unwind: "$services" },
          {
            $match: {
              "services.category": category,
              "services.subcategory": name,
            },
          },
          {
            $group: {
              _id: null,
              minPrice: { $min: "$services.price" },
            },
          },
        ]);

        if (priceAggregation.length > 0) {
          startingPrice = priceAggregation[0].minPrice;
        }
      }

      // Calculate average response time for this subcategory
      let avgResponseTime = "30 mins";

      const responseTimeAggregation = await Booking.aggregate([
        {
          $match: {
            "service.category": category,
            "service.subcategory": name, // Filter by subcategory name
            status: { $in: ["accepted", "in_progress", "completed"] },
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $lookup: {
            from: "providers",
            localField: "provider",
            foreignField: "_id",
            as: "providerData",
          },
        },
        { $unwind: "$providerData" },
        {
          $addFields: {
            acceptedTimeline: {
              $filter: {
                input: "$timeline",
                cond: { $eq: ["$$this.status", "accepted"] },
              },
            },
          },
        },
        {
          $addFields: {
            responseTime: {
              $cond: {
                if: { $gt: [{ $size: "$acceptedTimeline" }, 0] },
                then: {
                  $divide: [
                    {
                      $subtract: [
                        { $arrayElemAt: ["$acceptedTimeline.timestamp", 0] },
                        "$createdAt",
                      ],
                    },
                    1000 * 60,
                  ],
                },
                else: {
                  $divide: [
                    { $subtract: ["$updatedAt", "$createdAt"] },
                    1000 * 60,
                  ],
                },
              },
            },
          },
        },
        { $match: { responseTime: { $gte: 0 } } },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: "$responseTime" },
            count: { $sum: 1 },
          },
        },
      ]);

      if (
        responseTimeAggregation.length > 0 &&
        responseTimeAggregation[0].count > 0
      ) {
        const avgMinutes = Math.round(responseTimeAggregation[0].avgResponseTime);
        if (avgMinutes < 60) {
          avgResponseTime = `${avgMinutes} mins`;
        } else {
          const hours = Math.round(avgMinutes / 60);
          avgResponseTime = `${hours} ${hours === 1 ? "hour" : "hours"}`;
        }
      }

      return {
        category,
        subcategory: name,
        description,
        rating: averageRating || 0,
        reviews: totalReviews || 0,
        providers: providersCount || 0,
        startingPrice: startingPrice || 0,
        responseTime: avgResponseTime,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: subCategoryStats,
    category: category,
  });
});
