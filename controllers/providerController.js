import streamifier from "streamifier";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { Provider } from "../models/Provider.js";
import cloudinary from "cloudinary";
import { Booking } from "../models/Booking.js";

// Upload KYC documents
export const uploadKYC = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "provider") {
    return next(new ErrorHandler("Access denied", 403));
  }

  let { aadharNumber, panNumber } = req.body;

  aadharNumber = String(aadharNumber).trim();
  panNumber = String(panNumber).trim();

  if (!aadharNumber || !panNumber) {
    return next(new ErrorHandler("Please provide Aadhar and PAN numbers", 400));
  }

  const aadharFile = req.files?.aadharImage?.[0];
  const panFile = req.files?.panImage?.[0];

  if (!aadharFile || !panFile) {
    return next(
      new ErrorHandler("Please upload both Aadhar and PAN images", 400)
    );
  }

  const provider = await Provider.findById(req.user.id);
  if (!provider) {
    return next(new ErrorHandler("Provider not found", 404));
  }

  const uploadToCloudinary = async (buffer, folder) => {
    const base64String = buffer.toString("base64");
    const dataUri = `data:image/png;base64,${base64String}`;

    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        width: 800,
        crop: "scale",
      });
      return result;
    } catch (error) {
      throw error;
    }
  };

  const aadharResult = await uploadToCloudinary(
    aadharFile.buffer,
    "kyc/aadhar"
  );
  const panResult = await uploadToCloudinary(panFile.buffer, "kyc/pan");

  provider.kyc = {
    aadharNumber,
    panNumber,
    aadharImage: {
      public_id: aadharResult.public_id,
      url: aadharResult.secure_url,
    },
    panImage: {
      public_id: panResult.public_id,
      url: panResult.secure_url,
    },
    status: "pending",
  };

  await provider.save();

  res.status(200).json({
    success: true,
    message: "KYC documents uploaded successfully. Verification is pending.",
  });
});

// Add portfolio item
export const addPortfolioItem = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "provider") {
    return next(new ErrorHandler("Access denied", 403));
  }

  const { title, description } = req.body;

  if (!title || !description) {
    return next(new ErrorHandler("Please provide title and description", 400));
  }

  const provider = await Provider.findById(req.user.id);
  if (!provider) {
    return next(new ErrorHandler("Provider not found", 404));
  }

  const images = [];

  // Helper to upload image buffer to Cloudinary using base64
  const uploadToCloudinary = async (fileBuffer, mimetype) => {
    const base64String = fileBuffer.toString("base64");
    const dataUri = `data:${mimetype};base64,${base64String}`;
    return await cloudinary.uploader.upload(dataUri, {
      folder: "portfolio",
      width: 800,
      crop: "scale",
    });
  };

  if (req.files && req.files.images) {
    const files = Array.isArray(req.files.images)
      ? req.files.images
      : [req.files.images];

    for (let file of files) {
      try {
        const result = await uploadToCloudinary(file.buffer, file.mimetype);
        images.push({
          public_id: result.public_id,
          url: result.secure_url,
        });
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        return next(new ErrorHandler("Image upload failed", 500));
      }
    }
  }

  const portfolioItem = {
    title,
    description,
    images,
    completedAt: new Date(),
  };

  provider.portfolio.push(portfolioItem);
  await provider.save();

  res.status(201).json({
    success: true,
    message: "Portfolio item added successfully",
    portfolioItem,
  });
});

//update portfolio item
export const updatePortfolioItem = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "provider") {
    return next(new ErrorHandler("Access Denied", 403));
  }

  const { portfolioId } = req.params;
  const { title, description } = req.body;

  const provider = await Provider.findById(req.user.id);
  if (!provider) {
    return next(new ErrorHandler("Provider not found", 404));
  }

  const portfolioItem = provider.portfolio.id(portfolioId);
  if (!portfolioItem) {
    return next(new ErrorHandler("Portfolio Item not found", 404));
  }

  if (title?.trim()) portfolioItem.title = title.trim();
  if (description?.trim()) portfolioItem.description = description.trim();

  await provider.save();
  res.status(200).json({
    success: true,
    message: "Portfolio Item updated successfully",
    portfolio: provider.portfolio,
  });
});

//delete portfolio item
export const deletePortfolioItem = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "provider") {
    return next(new ErrorHandler("Access denied", 403));
  }

  const { portfolioId } = req.params;

  const provider = await Provider.findById(req.user.id);
  if (!provider) {
    return next(new ErrorHandler("Provider not found", 404));
  }

  const portfolioItem = provider.portfolio.id(portfolioId);
  if (!portfolioItem) {
    return next(new ErrorHandler("Portfolio item not found", 404));
  }

  for (let image of portfolioItem.images) {
    try {
      await cloudinary.v2.uploader.destroy(image.public_id);
    } catch (err) {
      console.error("Cloudinary deletion failed:", err);
    }
  }

  provider.portfolio.pull(portfolioId);
  await provider.save();

  res.status(200).json({
    success: true,
    message: "Portfolio item deleted successfully",
    deletedItemId: portfolioId,
  });
});


// Toggle Provider Availability (with auto-disable after working hours logic if endpoint is hit)
export const toggleAvailability = catchAsyncError(async (req, res, next) => {
    if (req.user.role !== "provider") {
        return next(new ErrorHandler("Access denied", 403));
    }

    const provider = await Provider.findById(req.user.id);
    if (!provider) {
        return next(new ErrorHandler("Provider not found", 404));
    }

    const currentDate = new Date();
    const currentDay = currentDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase(); // e.g., "monday"
    const workingHours = provider.workingHours?.[currentDay];

    // Scenario 1: If today is marked as unavailable in their working hours
    if (!workingHours?.available) {
        // If they are currently marked as available, auto-disable them
        if (provider.isAvailable) {
            const updated = await Provider.findByIdAndUpdate(
                req.user.id,
                { isAvailable: false },
                { new: true }
            );
            return res.status(200).json({
                success: true,
                message: `You are unavailable today (${currentDay}). Your availability has been auto-disabled.`,
                isAvailable: updated.isAvailable,
            });
        }
        // If they are already unavailable, just inform them
        return next(new ErrorHandler(`You are unavailable today (${currentDay}).`, 400));
    }

    // Scenario 2: If today is available, check current time against working hours
    const [endHour, endMinute] = workingHours.end.split(":").map(Number);
    const endTime = new Date(currentDate);
    endTime.setHours(endHour, endMinute, 0, 0);

    const [startHour, startMinute] = workingHours.start.split(":").map(Number);
    const startTime = new Date(currentDate);
    startTime.setHours(startHour, startMinute, 0, 0);

    // Auto-disable if current time is past the end time AND they are currently available
    if (currentDate > endTime && provider.isAvailable) {
        const updated = await Provider.findByIdAndUpdate(
            req.user.id,
            { isAvailable: false },
            { new: true }
        );
        return res.status(200).json({
            success: true,
            message: `Your working hours have ended. You are now marked as unavailable.`,
            isAvailable: updated.isAvailable,
        });
    }

    // Auto-disable if current time is before start time AND they are currently available
    if (currentDate < startTime && provider.isAvailable) {
        const updated = await Provider.findByIdAndUpdate(
            req.user.id,
            { isAvailable: false },
            { new: true }
        );
        return res.status(200).json({
            success: true,
            message: `Your working hours haven't started yet. You are now marked as unavailable.`,
            isAvailable: updated.isAvailable,
        });
    }

    // Scenario 3: Manual toggle allowed if within working hours or if they want to override
    const newAvailability = !provider.isAvailable;

    const updatedProvider = await Provider.findByIdAndUpdate(
        req.user.id,
        { isAvailable: newAvailability },
        { new: true }
    );

    res.status(200).json({
        success: true,
        message: `Availability ${
            updatedProvider.isAvailable ? "enabled" : "disabled"
        } successfully`,
        isAvailable: updatedProvider.isAvailable,
    });
});

//get earning summary
export const getEarningsSummary = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== "provider") {
    return next(new ErrorHandler("Access denied", 403));
  }

  const provider = await Provider.findById(req.user.id).select('earnings completedJobs');
  
  if (!provider) {
    return next(new ErrorHandler("Provider not found", 404));
  }

  res.status(200).json({
    success: true,
    earnings: provider.earnings,
    completedJobs: provider.completedJobs
  });
});


//update working hours
export const updateWorkingHours = catchAsyncError(async(req, res, next)=>{
  const {workingHours} = req.body;
  if (!workingHours || typeof workingHours !== "object") {
    return next(new ErrorHandler("Please provide valid working hours data", 400));
  }

  const provider = await Provider.findById(req.user.id);
  if(!provider){
    return next(ErrorHandler("Provider not found", 404));
  }

  provider.workingHours = workingHours;
  await provider.save();

  res.status(200).json({
    success: true,
    message: "Working hours updated successfully",
    workingHours: provider.workingHours,
  });
});



//get provider booking history
export const getProviderBookingHistory = catchAsyncError(async (req, res, next) => {
  const { page = 1, limit = 10, status } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const query = {provider: req.user._id };
  if (status) query.status = status;

  const totalBookings = await Booking.countDocuments(query);

  const bookings = await Booking.find(query)
    .populate("user", "name phone avatar")
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
