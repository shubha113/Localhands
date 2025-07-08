import mongoose from "mongoose";
import { Provider } from "../models/Provider.js";
import { Review } from "../models/Review.js";

const updateProviderRating = async (providerId) => {
  const stats = await Review.aggregate([
    { $match: { provider: new mongoose.Types.ObjectId(providerId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' }, 
        totalReviews: { $sum: 1 }       
      }
    }
  ]);

  if (stats.length > 0) {
    await Provider.findByIdAndUpdate(providerId, {
      'ratings.average': Math.round(stats[0].averageRating * 10) / 10, 
      'ratings.count': stats[0].totalReviews
    });
  } else {
    await Provider.findByIdAndUpdate(providerId, {
      'ratings.average': 0,
      'ratings.count': 0
    });
  }
};
export default updateProviderRating;