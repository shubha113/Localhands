import { catchAsyncError } from '../middlewares/catchAsyncError.js';
import { PushSubscription } from '../models/pushSubscription.js';

export const subscribePush = catchAsyncError(async (req, res, next) => {
  const { subscription } = req.body;
  const userId = req.user.id;
  const userType = req.user.role === 'provider' ? 'provider' : 'user';

  await PushSubscription.findOneAndUpdate(
    { userId, userType, endpoint: subscription.endpoint },
    {
      userId,
      userType,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      isActive: true
    },
    { upsert: true }
  );

  res.status(200).json({
    success: true,
    message: 'Push subscription saved'
  });
});