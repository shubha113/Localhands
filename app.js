import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import {createServer} from 'http';
import {Server} from 'socket.io';
import ErrorMiddleware from './middlewares/error.js';
import helmet from 'helmet';
import dotenv from 'dotenv'

import userRoutes from './routes/userRoute.js'
import providerRoutes from './routes/providerRoute.js'
import authRoutes from './routes/authRoutes.js'
import serviceRoutes from './routes/serviceRoute.js'
import bookingRoutes from './routes/bookingRoute.js'
import paymentRoutes from './routes/paymentRoute.js'
import adminRoutes from './routes/adminRoute.js'
import reviewRoutes from './routes/reviewRoute.js'
import chatRoutes from './routes/chatRoute.js';
import notificationRoutes from './routes/notificationRoute.js';


dotenv.config();
const app = express();
const server = createServer(app);

//socket.io setup
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

//make io accessible in routes
app.set('io', io);


// Security middleware
app.use(helmet());

//cors
app.use(cors({
    origin: process.env.CLIENT_URL || 'https://localhands-frontend.vercel.app',
    credentials: true,
    optionsSuccessStatus: 200
}));


//rate limiting
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: process.env.MAX_REQUESTS_PER_HOUR || 100,
    message: 'Too many requests from this IP, please try again later',
})
//this will get used on the those routes whose url starts with "/api/"
app.use('/api/v1', limiter);

//body parsers
app.use(cookieParser());
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({extended: true, limit: "10mb"}));

// Compression
app.use(compression());// use to compress the data server is sending

app.get("/", (req, res) => {
  res.send("API is running");
});


//Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/providers', providerRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/service', serviceRoutes);
app.use('/api/v1/booking', bookingRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/review', reviewRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1', notificationRoutes);

//socket.io connection handling
// Enhanced socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Store user info in socket
  socket.on('user-join', (userId) => {
    socket.userId = userId;
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });

  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.userId} joined chat ${chatId}`);
  });

  socket.on('leave-chat', (chatId) => {
    socket.leave(chatId);
    console.log(`User ${socket.userId} left chat ${chatId}`);
  });

  socket.on('send-message', (data) => {
    socket.to(data.chatId).emit('receive-message', data);
  });

  socket.on('typing', (data) => {
    socket.to(data.chatId).emit('user-typing', data);
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.chatId).emit('user-stop-typing', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});
app.use(ErrorMiddleware);

export { app, server };
// 404 handler
/*app.all('*', (req, res, next) => {
    const error = new Error(`Route ${req.originalUrl} not found`);
    error.statusCode = 404;
    next(error);
});*/
