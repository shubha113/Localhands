import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.ObjectId,
        refPath: 'senderType',
        required: true
    },
    senderType: {
        type: String,
        enum: ['User', 'Provider'],
        required: true
    },
    content: {
        type: String,
        required: true,
        maxLength: [1000, 'Message cannot exceed 1000 characters']
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'file', 'location'],
        default: 'text'
    },
    attachments: [{
        public_id: String,
        url: String,
        filename: String,
        size: Number
    }],
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: Date
}, {
    timestamps: true
});

const chatSchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.ObjectId,
        ref: 'Booking',
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    provider: {
        type: mongoose.Schema.ObjectId,
        ref: 'Provider',
        required: true
    },
    messages: [messageSchema],
    isActive: {
        type: Boolean,
        default: true
    },
    lastMessage: {
        content: String,
        sentAt: Date,
        sender: String
    },
    unreadCount: {
        user: { type: Number, default: 0 },
        provider: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// Index for efficient queries
chatSchema.index({ user: 1, updatedAt: -1 });
chatSchema.index({ provider: 1, updatedAt: -1 });
chatSchema.index({ booking: 1 });

export const Chat =  new mongoose.model("Chat", chatSchema);
