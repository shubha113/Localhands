import { User } from "../models/User.js";
import { Provider } from "../models/Provider.js";
import { Review } from "../models/Review.js";

export const handleReportAction = async (report, action) => {
  const { reportedType, reported } = report;

  switch (action) {
    case 'delete_review':
      if (reportedType === 'Review') {
        await Review.findByIdAndDelete(reported);
      }
      break;

    case 'suspension':
      if (reportedType === 'User') {
        await User.findByIdAndUpdate(reported, {
          isActive: false,
        });
      } else if (reportedType === 'Provider') {
        await Provider.findByIdAndUpdate(reported, {
          isActive: false,
        });
      }
      break;

    case 'ban':
      if (reportedType === 'User') {
        await User.findByIdAndUpdate(reported, {
          isActive: false,
          isBanned: true,
        });
      } else if (reportedType === 'Provider') {
        await Provider.findByIdAndUpdate(reported, {
          isActive: false,
          isBanned: true,
        });
      }
      break;

    case 'warning':
      // or simply leave this as a placeholder
      console.log(`Warning issued to ${reportedType} with ID ${reported}`);
      break;

    case 'no_action':
      break;

    default:
      console.warn(`Unhandled action type: ${action}`);
      break;
  }
};
