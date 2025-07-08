import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { Booking } from "../models/Booking.js";
import { Provider } from "../models/Provider.js";
import { User } from "../models/User.js";
import { Review } from "../models/Review.js";
import ErrorHandler from "../utils/errorHandler.js";


// Get booking analytics (Admin)
export const getBookingAnalytics = catchAsyncError(async (req, res, next) => {
    let { startDate, endDate } = req.query;

    const matchQuery = {};

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        if (isNaN(start) || isNaN(end)) {
            return next(new ErrorHandler('Invalid date format', 400));
        }

        matchQuery.createdAt = {
            $gte: start,
            $lte: end
        };
    }

    const analytics = await Booking.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                pendingBookings: {
                    $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                },
                acceptedBookings: {
                    $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
                },
                completedBookings: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                },
                cancelledBookings: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                },
                totalRevenue: {
                    $sum: {
                        $cond: [
                            { $eq: ['$status', 'completed'] },
                            '$pricing.totalAmount',
                            0
                        ]
                    }
                },
                averageOrderValue: { $avg: '$pricing.totalAmount' }
            }
        }
    ]);

    const summary = analytics[0] || {
        totalBookings: 0,
        pendingBookings: 0,
        acceptedBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalRevenue: 0,
        averageOrderValue: 0
    };

    const statusDistributionRaw = await Booking.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const statusDistribution = statusDistributionRaw.map(item => ({
        status: item._id,
        count: item.count
    }));

    res.status(200).json({
        success: true,
        analytics: summary,
        statusDistribution
    });
});


//get dashboard stats
export const getDashboardStats = catchAsyncError(async (req, res, next) => {
  // Check if user is admin
  if (req.user.role !== "admin") {
    return next(new ErrorHandler("Access denied", 403));
  }

  // Get current date and date ranges
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisYear = new Date(now.getFullYear(), 0, 1);

  // Get total counts
  const [
    totalUsers,
    totalProviders,
    totalBookings,
    totalReviews,
    activeUsers,
    verifiedProviders,
    pendingKyc,
    completedBookings,
    totalRevenue,
    monthlyRevenue,
    recentBookings,
    topProviders,
    pendingReports
  ] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Provider.countDocuments(),
    Booking.countDocuments(),
    Review.countDocuments(),
    User.countDocuments({ isActive: true, role: "user" }),
    Provider.countDocuments({ isVerified: true }),
    Provider.countDocuments({ "kyc.status": "pending" }),
    Booking.countDocuments({ status: "completed" }),
    Booking.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$pricing.platformFee" } } }
    ]),
    Booking.aggregate([
      { 
        $match: { 
          status: "completed", 
          createdAt: { $gte: thisMonth } 
        } 
      },
      { $group: { _id: null, total: { $sum: "$pricing.platformFee" } } }
    ]),
    Booking.find()
      .populate("user", "name email")
      .populate("provider", "name businessName")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("service status totalAmount createdAt"),
    Provider.find({ isVerified: true })
      .sort({ "ratings.average": -1, completedJobs: -1 })
      .limit(5)
      .select("name businessName ratings completedJobs"),
    Review.countDocuments({ reportStatus: "pending" })
  ]);

  // Get monthly booking trends
  const bookingTrends = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        count: { $sum: 1 },
        revenue: { $sum: "$pricing.platformFee" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  // Get user registration trends
  const userTrends = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
        role: "user"
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  // Get service category distribution
  const serviceStats = await Booking.aggregate([
    {
      $group: {
        _id: "$service.category",
        count: { $sum: 1 },
        revenue: { $sum: "$pricing.platformFee" }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const stats = {
    overview: {
      totalUsers,
      totalProviders,
      totalBookings,
      totalReviews,
      activeUsers,
      verifiedProviders,
      pendingKyc,
      completedBookings,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      pendingReports
    },
    trends: {
      bookings: bookingTrends,
      users: userTrends,
      services: serviceStats
    },
    recent: {
      bookings: recentBookings,
      topProviders
    }
  };

  res.status(200).json({
    success: true,
    data: stats
  });
});


//approve provider KYC
export const approveProviderKyc = catchAsyncError(async(req, res, next)=>{
    const { providerId } = req.params;

    if(req.user.role !== "admin"){
        return next(new ErrorHandler("You cannot access this resource", 403));
    }

    const provider = await Provider.findById(providerId);
    if(!provider){
        return next(new ErrorHandler("Provider not found", 404));
    }

    if(provider.kyc.status !== "pending"){
        return next(new ErrorHandler("KYC is not in pending state", 400));
    }

    provider.kyc.status = "approved";
    provider.kyc.verifiedAt = new Date();
    provider.status = "verified";

    await provider.save();

    res.status(200).json({
        success: true,
        message: "Provider KYC approved successfully"
    });
});


//reject provider kyc
export const rejectProviderKyc = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "admin") {
    return next(new ErrorHandler("Access denied", 403));
  }

  const { providerId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return next(new ErrorHandler("Please provide rejection reason", 400));
  }

  const provider = await Provider.findById(providerId);
  if (!provider) {
    return next(new ErrorHandler("Provider not found", 404));
  }

  if (provider.kyc.status !== "pending") {
    return next(new ErrorHandler("KYC is not in pending status", 400));
  }

  provider.kyc.status = "rejected";
  provider.kyc.rejectionReason = reason;
  provider.status = "rejected";

  await provider.save();

  res.status(200).json({
    success: true,
    message: "Provider KYC rejected successfully"
  });
});


//toggle provider suspension
export const toggleProviderSuspension = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "admin") {
    return next(new ErrorHandler("Access denied", 403));
  }

  const { providerId } = req.params;
  const { reason } = req.body;

  const provider = await Provider.findById(providerId);
  if (!provider) {
    return next(new ErrorHandler("Provider not found", 404));
  }

  const wasBanned = provider.isBanned;
  provider.isBanned = !provider.isBanned;
  provider.isActive = !provider.isBanned;
  
  if (provider.isBanned) {
    provider.status = "suspended";
    provider.isAvailable = false;
    if (reason) {
      provider.suspensionReason = reason;
      provider.suspendedAt = new Date();
    }
  } else {
    provider.status = provider.isVerified ? "verified" : "pending";
    provider.isAvailable = true;
    provider.suspensionReason = undefined;
    provider.suspendedAt = undefined;
  }

  await provider.save();

  res.status(200).json({
    success: true,
    message: `Provider ${wasBanned ? 'unsuspended' : 'suspended'} successfully`
  });
});


//get all bookings
export const getAllBookings = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "admin") {
    return next(new ErrorHandler("Access denied", 403));
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  if (req.query.paymentStatus) {
    filter.paymentStatus = req.query.paymentStatus;
  }

  if (req.query.category) {
    filter['service.category'] = req.query.category;
  }

  if (req.query.dateFrom && req.query.dateTo) {
    filter.createdAt = {
      $gte: new Date(req.query.dateFrom),
      $lte: new Date(req.query.dateTo)
    };
  }

  const [bookings, totalBookings] = await Promise.all([
    Booking.find(filter)
      .populate("user", "name email phone")
      .populate("provider", "name businessName phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(totalBookings / limit);

  res.status(200).json({
    success: true,
    data: {
      bookings,
      pagination: {
        currentPage: page,
        totalPages,
        totalBookings,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  });
});
