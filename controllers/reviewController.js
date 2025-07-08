import streamifier from "streamifier";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import {Booking} from '../models/Booking.js'
import {handleReportAction} from '../utils/handleReportAction.js'
import ErrorHandler from "../utils/errorHandler.js";
import cloudinary from "../utils/cloudinary.js";
import { Review } from "../models/Review.js";
import updateProviderRating from "../utils/updateProviderRating.js";
import mongoose from "mongoose";
import { Report } from "../models/Report.js";
import { User } from "../models/User.js";
import { Provider } from "../models/Provider.js";


//create review
export const createReview = catchAsyncError(async (req, res, next) => {
  const { bookingId, rating, title, comment, aspects } = req.body;

  const booking = await Booking.findById(bookingId)
    .populate("user")
    .populate("provider");

  if (!booking) {
    return next(new ErrorHandler("Booking not found", 404));
  }

  if (booking.user._id.toString() !== req.user.id) {
    return next(new ErrorHandler("Not authorized to review this booking", 403));
  }

  if (booking.status !== "completed") {
    return next(new ErrorHandler("You can only review completed bookings", 400));
  }

  const existingReview = await Review.findOne({
    booking: bookingId,
    user: req.user.id
  });

  if (existingReview) {
    return next(new ErrorHandler("You have already reviewed this booking", 400));
  }

  let parsedAspects = undefined;
  if (aspects) {
    try {
      parsedAspects = JSON.parse(aspects);
    } catch (error) {
      return next(new ErrorHandler("Invalid JSON format for aspects", 400));
    }

    for (const key in parsedAspects) {
      const val = parsedAspects[key];
      if (val < 1 || val > 5) {
        return next(new ErrorHandler(`${key} rating must be between 1 and 5`, 400));
      }
    }
  }

  let uploadedImages = [];
  if (req.file) {
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "reviews" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    const result = await streamUpload(req.file.buffer);
    uploadedImages.push({
      public_id: result.public_id,
      url: result.secure_url
    });
  }

  const review = await Review.create({
    user: req.user.id,
    provider: booking.provider._id,
    booking: bookingId,
    rating,
    title,
    comment,
    images: uploadedImages,
    aspects: parsedAspects,
    service: {
      category: booking.service.category,
      subcategory: booking.service.subcategory
    }
  });

  await updateProviderRating(booking.provider._id);

  await review.populate([
    { path: "user", select: "name avatar" },
    { path: "provider", select: "name businessName" }
  ]);

  res.status(201).json({
    success: true,
    message: "Review created successfully",
    review
  });
});


//get provider reviews
export const getProviderReviews = catchAsyncError(async (req, res, next) => {
  const { providerId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const rating = req.query.rating;

  if (!providerId) {
    return next(new ErrorHandler("Invalid provider ID", 400));
  }

  const query = { provider: providerId };

  if (rating) {
    const parsedRating = parseInt(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return next(new ErrorHandler("Rating must be a number between 1 and 5", 400));
    }
    query.rating = parsedRating;
  }

  const skip = (page - 1) * limit;

  const reviews = await Review.find(query)
    .populate('user', 'name avatar')
    .populate('booking', 'service.category service.subcategory scheduledDateTime')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)

  const totalReviews = await Review.countDocuments(query);

  const rawDistribution = await Review.aggregate([
    { $match: { provider: new mongoose.Types.ObjectId(providerId) } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);

  const ratingDistribution = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: rawDistribution.find(d => d._id === r)?.count || 0
  }));

  res.status(200).json({
    success: true,
    reviews,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit),
      totalReviews,
      hasNext: page < Math.ceil(totalReviews / limit),
      hasPrev: page > 1
    },
    ratingDistribution
  });
});


//get review details
export const getReviewDetails = catchAsyncError(async(req, res, next)=>{
    const {reviewId} = req.params;
    if(!reviewId){
        return next(new ErrorHandler("Review Id not found", 404));
    }

    const review = await Review.findById(reviewId)
    .populate("user", "name avatar")
    .populate("provider", "name businessName avatar")
    .populate("booking", "service.category service.subcategory scheduledDateTime");

    if(!review){
        return next (new ErrorHandler("Review not found"));
    }

    res.status(200).json({
        success: true,
        review
    })
})


//update review
export const updateReview = catchAsyncError(async (req, res, next) => {
  const { rating, comment } = req.body;

  const review = await Review.findById(req.params.reviewId);
  if (!review) return next(new ErrorHandler("Review not found", 404));

  if (review.user.toString() !== req.user.id) {
    return next(new ErrorHandler("Not authorized to update this review", 403));
  }

  const editTimeLimit = 24 * 60 * 60 * 1000;
  if (Date.now() - review.createdAt.getTime() > editTimeLimit) {
    return next(new ErrorHandler("Review edit time limit exceeded", 400));
  }

  if (rating && (rating < 1 || rating > 5)) {
    return next(new ErrorHandler("Rating must be between 1 and 5", 400));
  }

  if (req.file) {
    for (const img of review.images) {
      if (img.public_id) {
        await cloudinary.uploader.destroy(img.public_id);
      }
    }

    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "reviews" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    const result = await streamUpload(req.file.buffer);
    review.images = [
      {
        public_id: result.public_id,
        url: result.secure_url,
      },
    ];
  }

  review.rating = rating ?? review.rating;
  review.comment = comment ?? review.comment;
  review.isEdited = true;

  await review.save();
  await updateProviderRating(review.provider);

  res.status(200).json({
    success: true,
    message: "Review updated successfully",
    review,
  });
});


//delete review
export const deleteReview = catchAsyncError(async (req, res, next) => {
  const review = await Review.findById(req.params.reviewId);

  if (!review) {
    return next(new ErrorHandler("Review not found", 404));
  }

  if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorHandler("Not authorized to delete this review", 403));
  }

  const providerId = review.provider;

  if (review.images && review.images.length > 0) {
    for (const img of review.images) {
      if (img.public_id) {
        await cloudinary.uploader.destroy(img.public_id);
      }
    }
  }

  await Review.findByIdAndDelete(req.params.reviewId);

  await updateProviderRating(providerId);

  res.status(200).json({
    success: true,
    message: "Review deleted successfully",
  });
});


//get user reviews
export const getUserReviews = catchAsyncError(async(req, res, next)=>{
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({user: req.user.id})
    .populate("provider", "name businessName avatar")
    .populate("booking", "service scheduledDateTime")
    .select("title rating comment")
    .sort({createdAt: -1})
    .skip(skip)
    .limit(limit)

    if(!reviews || reviews.length === 0){
        return next(new ErrorHandler("No reviews found"), 404);
    }

    const totalReviews = await Review.countDocuments({user: req.user.id});

    res.status(200).json({
        success: true,
        reviews,
        pagination:{
            currentPage: page,
            totalPages: Math.ceil(totalReviews / limit),
            totalReviews
        }
    });
});


//get review stats
export const getReviewStats = catchAsyncError(async (req, res, next) => {
  const { providerId } = req.params;

  const stats = await Review.aggregate([
    { $match: { provider: new mongoose.Types.ObjectId(providerId) } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratings: {
          $push: '$rating'
        }
      }
    },
    {
      $project: {
        totalReviews: 1,
        averageRating: { $round: ['$averageRating', 1] },
        ratingDistribution: {
          5: {
            $size: {
              $filter: {
                input: '$ratings',
                cond: { $eq: ['$$this', 5] }
              }
            }
          },
          4: {
            $size: {
              $filter: {
                input: '$ratings',
                cond: { $eq: ['$$this', 4] }
              }
            }
          },
          3: {
            $size: {
              $filter: {
                input: '$ratings',
                cond: { $eq: ['$$this', 3] }
              }
            }
          },
          2: {
            $size: {
              $filter: {
                input: '$ratings',
                cond: { $eq: ['$$this', 2] }
              }
            }
          },
          1: {
            $size: {
              $filter: {
                input: '$ratings',
                cond: { $eq: ['$$this', 1] }
              }
            }
          }
        }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    stats: stats[0] || {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    }
  });
});


//report review
export const reportReview = catchAsyncError(async (req, res, next) => {
  const { reason, description } = req.body;
  const { reviewId } = req.params;

  const review = await Review.findById(reviewId);
  if (!review) {
    return next(new ErrorHandler("Review not found", 404));
  }
  const existingReport = await Report.findOne({
    reporter: req.user.id,
    reporterType: req.user.role === 'provider' ? 'Provider' : 'User',
    reported: reviewId,
    reportedType: 'Review',
  });

  if (existingReport) {
    return next(new ErrorHandler("You have already reported this review", 400));
  }

  const report = await Report.create({
    reporter: req.user.id,
    reporterType: req.user.role === 'provider' ? 'Provider' : 'User',
    reported: reviewId,
    reportedType: 'Review',
    reason,
    description,
  });

  res.status(201).json({
    success: true,
    message: "Review reported successfully",
    report
  });
});


//report user
export const reportUser = catchAsyncError(async(req, res, next)=>{
    const {reason, description} = req.body;
    const {userId} = req.params;

    const user = await User.findById(userId);
    if(!user){
        return next(new ErrorHandler("User not found", 404));
    }

    const existingReport = await Report.findOne({
        reporter: req.user.id,
        reporterType: req.user.role === 'provider' ? "Provider" : "User",
        reported: userId,
        reportedType: "User"
    })

     if (existingReport) {
    return next(new ErrorHandler("You have already reported this user", 400));
    }

    const report = await Report.create({
        reporter: req.user.id,
        reporterType: req.user.role === 'provider' ? "Provider" : "User",
        reported: userId,
        reportedType: "User",
        reason,
        description
    });

     res.status(201).json({
    success: true,
    message: "User reported successfully",
    report,
  });
})


//report provider
export const reportProvider = catchAsyncError(async(req, res, next)=>{
    const {reason, description} = req.body;
    const {providerId} = req.params;

    const user = await Provider.findById(providerId);
    if(!user){
        return next(new ErrorHandler("Provider not found", 404));
    }

    const existingReport = await Report.findOne({
        reporter: req.user.id,
        reporterType: req.user.role === 'provider' ? "Provider" : "User",
        reported: providerId,
        reportedType: "Provider"
    })

     if (existingReport) {
    return next(new ErrorHandler("You have already reported this provider", 400));
    }

    const report = await Report.create({
        reporter: req.user.id,
        reporterType: req.user.role === 'provider' ? "Provider" : "User",
        reported: providerId,
        reportedType: "Provider",
        reason,
        description
    });

     res.status(201).json({
    success: true,
    message: "Provider reported successfully",
    report,
  });
});


//get all reports
export const getAllReports = catchAsyncError(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const { status, targetType } = req.query;

  const validStatuses = ['pending', 'investigating', 'resolved', 'dismissed'];
  const validTargetTypes = ['User', 'Provider', 'Review'];

  const query = {};

  if (status) {
    if (!validStatuses.includes(status)) {
      return next(new ErrorHandler('Invalid report status', 400));
    }
    query.status = status;
  }

  if (targetType) {
    if (!validTargetTypes.includes(targetType)) {
      return next(new ErrorHandler('Invalid target type', 400));
    }
    query.reportedType = targetType;
  }

  const reports = await Report.find(query)
    .populate('reporter', 'name email')
    .populate('reported', 'name email title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalReports = await Report.countDocuments(query);

  res.status(200).json({
    success: true,
    reports,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalReports / limit),
      totalReports
    }
  });
});


//handle report action 
export const updateReportStatus = catchAsyncError(async (req, res, next) => {
  const { status, adminNotes, action } = req.body;
  const { reportId } = req.params;

  const validStatuses = ['pending', 'investigating', 'resolved', 'dismissed'];
  const validActions = ['warning', 'suspension', 'ban', 'no_action'];

  if (!validStatuses.includes(status)) {
    return next(new ErrorHandler("Invalid report status", 400));
  }

  if (action && !validActions.includes(action)) {
    return next(new ErrorHandler("Invalid action type", 400));
  }

  const report = await Report.findById(reportId);
  if (!report) {
    return next(new ErrorHandler("Report not found", 404));
  }

  report.status = status;
  report.adminNotes = adminNotes;
  report.action = action;
  report.resolvedBy = req.user._id;
  report.resolvedAt = new Date();

  await report.save();

  if (action && status === 'resolved') {
    await handleReportAction(report, action);
  }

  res.status(200).json({
    success: true,
    message: "Report status updated successfully",
    report
  });
});
