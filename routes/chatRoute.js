import express from 'express';
import { authorizeRoles, isAuthenticated, isVerified } from '../middlewares/auth.js';
import { closeChatRoom, createChatRoom, getChatMessages, getUserChatRooms, markMessagesAsRead, sendMessage } from '../controllers/chatController.js';
import singleUpload from '../middlewares/multer.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});


router.post("/create", isAuthenticated, isVerified, createChatRoom);
router.post("/send/:chatId",isAuthenticated, isVerified, upload.fields([{ name: "attachments", maxCount: 5 }]), sendMessage);
router.get('/get-messages/:chatId', isAuthenticated, isVerified, getChatMessages);
router.patch('/:chatId/read', isAuthenticated, isVerified, markMessagesAsRead);
router.get('/user', isAuthenticated, isVerified, getUserChatRooms);
router.put('/close/:chatId', isAuthenticated, isVerified, closeChatRoom);


export default router;