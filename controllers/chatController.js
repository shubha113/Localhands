import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { Booking } from "../models/Booking.js";
import { Chat } from "../models/Chat.js";
import ErrorHandler from "../utils/errorHandler.js";
import cloudinary from "cloudinary";
import streamifier from "streamifier";

const uploadToCloudinary = (buffer, folder = "chat_attachments") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

export const createChatRoom = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId)
    .populate("user", "name avatar")
    .populate("provider", "name businessName avatar");
  if (!booking) {
    return next(new ErrorHandler("Booking not found", 404));
  }

  const isUser = booking.user._id.toString() === req.user.id;
  const isProvider = booking.provider._id.toString() === req.user.id;
  if (!isUser && !isProvider) {
    return next(
      new ErrorHandler("Not authorized to access this resource", 403)
    );
  }

  const disallowedStatuses = ["pending", "cancelled", "expired"];
  if (disallowedStatuses.includes(booking.status)) {
    return next(
      new ErrorHandler("Chat is avaialable only after booking is accepted", 400)
    );
  }
  let chatRoom = await Chat.findOne({ booking: bookingId }).lean();

  if (chatRoom) {
    return res.status(200).json({
      success: true,
      message: "Chat room already exists",
      chatRoom,
    });
  }

  chatRoom = await Chat.create({
    booking: bookingId,
    user: booking.user._id,
    provider: booking.provider._id,
  });

  return res.status(201).json({
    success: true,
    message: "Chat room created",
    chatRoom: chatRoom.toObject(),
  });
});

//send message
export const sendMessage = catchAsyncError(async (req, res, next) => {
  const { chatId } = req.params;
  const { messageType = "text", content } = req.body;

  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  const userId = req.user.id;
  const isUser = chat.user.toString() === userId;
  const isProvider = chat.provider.toString() === userId;

  if (!isUser && !isProvider) {
    return next(
      new ErrorHandler("Unauthorized to send message in this chat", 403)
    );
  }

  const senderType = isUser ? "User" : "Provider";

  let attachments = [];

  const uploadedFiles = req.files?.attachments;

  if (uploadedFiles && uploadedFiles.length > 0) {
    for (const file of uploadedFiles) {
      const result = await uploadToCloudinary(file.buffer, "chat_attachments");
      attachments.push({
        public_id: result.public_id,
        url: result.secure_url,
        filename: file.originalname,
        size: file.size,
      });
    }
  }

  const newMessage = {
    sender: userId,
    senderType,
    content: content || "",
    messageType,
    attachments,
    isRead: false,
    readAt: null,
  };

  chat.messages.push(newMessage);
  chat.lastMessage = {
    content: messageType === "text" ? content : `Sent a ${messageType}`,
    sentAt: new Date(),
    sender: senderType,
  };

  if (senderType === "User") {
    chat.unreadCount.provider += 1;
  } else {
    chat.unreadCount.user += 1;
  }

  await chat.save();

  const io = req.app.get("io");
  io.to(chatId).emit("new-message", {
    chatId,
    message: chat.messages[chat.messages.length - 1],
  });

  res.status(201).json({
    success: true,
    message: "Message sent successfully",
    data: chat.messages[chat.messages.length - 1],
  });
});

//get chat messages
export const getChatMessages = catchAsyncError(async (req, res, next) => {
  const { chatId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  const chatRoom = await Chat.findById(chatId)
    .populate("user", "name avatar")
    .populate("provider", "name businessName avatar")
    .populate("booking", "service status scheduledDateTime");

  if (!chatRoom) {
    return next(new ErrorHandler("Chat room not found", 404));
  }

  const isUser = chatRoom.user._id.toString() === req.user.id;
  const isProvider = chatRoom.provider._id.toString() === req.user.id;

  if (!isUser && !isProvider) {
    return next(new ErrorHandler("Not authorized to access this chat", 403));
  }

  const totalMessages = chatRoom.messages.length;
  const startIndex = Math.max(0, totalMessages - page * limit);
  const endIndex = Math.max(0, totalMessages - (page - 1) * limit);

  const paginatedMessages = chatRoom.messages
    .slice(startIndex, endIndex)
    .reverse();

  const messagesWithSenderInfo = paginatedMessages.map((message) => {
    const senderInfo =
      message.senderType === "User"
        ? {
            name: chatRoom.user.name,
            avatar: chatRoom.user.avatar,
          }
        : {
            name: chatRoom.provider.name,
            businessName: chatRoom.provider.businessName,
            avatar: chatRoom.provider.avatar,
          };

    return {
      ...message.toObject(),
      senderInfo,
    };
  });

  res.status(200).json({
    success: true,
    chatRoom: {
      _id: chatRoom._id,
      booking: chatRoom.booking,
      user: chatRoom.user,
      provider: chatRoom.provider,
      isActive: chatRoom.isActive,
    },
    messages: messagesWithSenderInfo,
    pagination: {
      currentPage: page,
      totalMessages,
      hasMore: startIndex > 0,
    },
  });
});

//mark messages as read
export const markMessagesAsRead = catchAsyncError(async (req, res, next) => {
  const { chatId } = req.params;

  const chatRoom = await Chat.findById(chatId);
  if (!chatRoom) return next(new ErrorHandler("Chat room not found", 404));

  const isUser = chatRoom.user._id.toString() === req.user.id;
  const isProvider = chatRoom.provider._id.toString() === req.user.id;
  if (!isUser && !isProvider)
    return next(new ErrorHandler("Not authorized to access this chat", 403));

  let updatedCount = 0;

  chatRoom.messages.forEach((message) => {
    if (message.sender.toString() !== req.user.id && !message.isRead) {
      message.isRead = true;
      message.readAt = new Date();
      updatedCount++;
    }
  });

  if (updatedCount > 0) await chatRoom.save();

  res.status(200).json({
    success: true,
    message: `${updatedCount} messages marked as read`,
  });
});

//get user chatRooms
export const getUserChatRooms = catchAsyncError(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const chatRooms = await Chat.find({
    $or: [
      { user: req.user.id },
      { provider: req.user.id }
    ]
  })
    .populate('user', 'name avatar')
    .populate('provider', 'name businessName avatar')
    .populate('booking', 'service status scheduledDateTime')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalChats = await Chat.countDocuments({
    $or: [
      { user: req.user.id },
      { provider: req.user.id }
    ]
  });

  const chatRoomsWithUnread = chatRooms.map(chat => {
    const unreadCount = chat.messages.filter(message =>
      message.sender.toString() !== req.user.id &&
      !(message.readBy || []).includes(req.user.id)
    ).length;

    return {
      ...chat.toObject(),
      unreadCount
    };
  });

  res.status(200).json({
    success: true,
    chatRooms: chatRoomsWithUnread,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalChats / limit),
      totalChats
    }
  });
});


//close chat room
export const closeChatRoom = catchAsyncError(async (req, res, next) => {
  const { chatId } = req.params;

  const chatRoom = await Chat.findById(chatId).populate('booking');

  if (!chatRoom) {
    return next(new ErrorHandler("Chat room not found", 404));
  }

  const isParticipant = 
    chatRoom.user.toString() === req.user.id || 
    chatRoom.provider.toString() === req.user.id;

  const isAdmin = req.user.role === 'admin';

  if (!isParticipant && !isAdmin) {
    return next(new ErrorHandler("Not authorized to close this chat", 403));
  }

  if (!['completed', 'cancelled'].includes(chatRoom.booking?.status)) {
    return next(
      new ErrorHandler(
        "Chat can only be closed after booking completion or cancellation",
        400
      )
    );
  }
  chatRoom.isActive = false;

  await chatRoom.save();

  res.status(200).json({
    success: true,
    message: "Chat room closed successfully"
  });
});


//get chat stats
export const getChatStats = catchAsyncError(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorHandler("Access denied", 403));
  }

  const stats = await Chat.aggregate([
    {
      $project: {
        messageCount: { $size: '$messages' },
        isActive: 1
      }
    },
    {
      $group: {
        _id: null,
        totalChats: { $sum: 1 },
        activeChats: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        closedChats: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        },
        totalMessages: { $sum: '$messageCount' },
        averageMessagesPerChat: { $avg: '$messageCount' }
      }
    }
  ]);

  const dailyStats = await Chat.aggregate([
    { $unwind: '$messages' },
    {
      $match: {
        'messages.createdAt': {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$messages.createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    stats: stats[0] || {
      totalChats: 0,
      activeChats: 0,
      closedChats: 0,
      totalMessages: 0,
      averageMessagesPerChat: 0
    },
    dailyStats
  });
});
