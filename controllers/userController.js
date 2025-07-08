import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { Provider } from "../models/Provider.js";
import { User} from "../models/User.js";
import {Booking} from "../models/Booking.js"
import ErrorHandler from "../utils/errorHandler.js";
import { generateTimeSlots } from "../utils/generateTime.js";
import haversine from "haversine-distance";

//get all providers
export const getAllNearbyProviders = catchAsyncError(async (req, res, next) => {
  const { category, subcategory, page = 1, limit = 10 } = req.query;

  if (!category || !subcategory) {
    return next(new ErrorHandler("Category and subcategory are required", 400));
  }

  const user = await User.findById(req.user.id);
  if (
    !user ||
    !user.address?.coordinates?.latitude ||
    !user.address?.coordinates?.longitude
  ) {
    return next(
      new ErrorHandler(
        "User location not found. Please update your profile with location.",
        400
      )
    );
  }

  const userLat = user.address.coordinates.longitude;
  const userLng = user.address.coordinates.latitude;

  const userCoords = [userLng, userLat];

  const radiusInRadians = 10 / 6378.1; // 10 km radius in radians

  const query = {
    status: "verified",
    isActive: true,
    isAvailable: true,
    location: {
      $geoWithin: {
        $centerSphere: [userCoords, radiusInRadians],
      },
    },
    services: {
      $elemMatch: {
        category,
        subcategory,
      },
    },
  };

  const skip = (page - 1) * limit;

  const providers = await Provider.find(query)
    .select(
      "name businessName avatar ratings experience description isAvailable services location"
    )
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Provider.countDocuments(query);

  const providersWithDistance = providers.map((provider) => {
    const distanceMeters = haversine(
      { lat: userLat, lon: userLng },
      {
        lat: provider.location.coordinates[1],
        lon: provider.location.coordinates[0],
      }
    );

    const matchingService = provider.services.find(
      (s) =>
        s.category === category &&
        s.subcategory.toLowerCase() === subcategory.toLowerCase()
    );

    return {
      _id: provider._id,
      name: provider.name,
      businessName: provider.businessName,
      avatar: provider.avatar,
      distance: (distanceMeters / 1000).toFixed(2), // distance in km
      rating: provider.ratings?.average || 0,
      isAvailable: provider.isAvailable,
      experience: provider.experience,
      description: provider.description,
      service: matchingService
        ? {
            category: matchingService.category,
            subcategory: matchingService.subcategory,
            price: matchingService.price,
            unit: matchingService.unit,
            description: matchingService.description,
          }
        : null,
    };
  });

  // Sort by distance (since $geoWithin doesn't sort automatically)
  providersWithDistance.sort(
    (a, b) => parseFloat(a.distance) - parseFloat(b.distance)
  );

  res.status(200).json({
    success: true,
    providers: providersWithDistance,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalProviders: total,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  });
});


//get single provider details
export const getProviderDetails = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const provider = await Provider.findById(id)
    .populate('services.category', 'name')
    .select('-password -kyc -bankDetails -resetPasswordToken -emailVerificationToken -phoneVerificationOTP');

  if (!provider) {
    return next(new ErrorHandler("Provider not found", 404));
  }

  if (provider.status !== 'verified' || !provider.isActive) {
    return next(new ErrorHandler("Provider is not available", 404));
  }

  res.status(200).json({
    success: true,
    provider
  });
});


//get providers by name and business name
export const searchProviders = catchAsyncError(async (req, res, next) => {
  const { q, page = 1, limit = 10 } = req.query;

  if (!q) {
    return next(new ErrorHandler("Please provide search query", 400));
  }

  const pageNum = Math.max(1, parseInt(page)) || 1;
  const limitNum = Math.max(1, parseInt(limit)) || 10;
  const skip = (pageNum - 1) * limitNum;

  const query = {
    status: 'verified',
    isActive: true,
    isAvailable: true,
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { businessName: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } }
    ]
  };

  const providers = await Provider.find(query)
    .populate('services.category', 'name')
    .select('name businessName avatar ratings services location')
    .sort({ 'ratings.average': -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Provider.countDocuments(query);

  res.status(200).json({
    success: true,
    providers,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalProviders: total
    }
  });
});


//get user booking history
export const getUserBookingHistory = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "user") {
    return next(new ErrorHandler("Access denied", 403));
  }

  const { page = 1, limit = 10, status } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const query = { user: req.user._id };
  if (status) query.status = status;

  const totalBookings = await Booking.countDocuments(query);

  const bookings = await Booking.find(query)
    .populate("provider", "name businessName avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const totalPages = Math.ceil(totalBookings / limitNum);

  res.status(200).json({
    success: true,
    bookings,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalBookings,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    }
  });
});


// Check provider availability
export const checkProviderAvailability = catchAsyncError(async (req, res, next) => {
    const { providerId, date, duration = 2 } = req.query;

    const durationInHours = Number(duration);
    
    if (!providerId || !date) {
        return next(new ErrorHandler('Provider ID and date are required', 400));
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
        return next(new ErrorHandler('Provider not found', 404));
    }

    const checkDate = new Date(date);
    const dayOfWeek = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Check provider works on this day
    const workingHours = provider.workingHours[dayOfWeek];
    if (!workingHours || !workingHours.available) {
        return res.status(200).json({
            success: true,
            available: false,
            reason: 'Provider does not work on this day'
        });
    }

    // Check existing bookings
    const existingBookings = await Booking.find({
        provider: providerId,
        scheduledDateTime: {
            $gte: checkDate.setHours(0, 0, 0, 0),
            $lte: checkDate.setHours(23, 59, 59, 999)
        },
        status: { $in: ['accepted', 'in_progress'] }
    });

    const availableSlots = generateTimeSlots(workingHours, existingBookings, durationInHours);

    res.status(200).json({
        success: true,
        available: availableSlots.length > 0,
        availableSlots,
        workingHours
    });
});
