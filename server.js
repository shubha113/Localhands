// server.js
import { server } from './app.js';
import connectDB from "./config/database.js";
import dotenv from 'dotenv';
import cloudinary from 'cloudinary';

process.on('uncaughtException', (error) => {
  console.log(`Error: ${error.message}`);
  console.log("Shutting down server due to uncaught exception");
  process.exit(1);
});

dotenv.config();
connectDB();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

process.on('unhandledRejection', (error) => {
  console.log(`Error: ${error.message}`);
  console.log("Shutting down server due to unhandled promise rejection");
  server.close(() => {
    process.exit(1);
  });
});
