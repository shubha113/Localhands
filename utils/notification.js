import webpush from "web-push";
import nodemailer from "nodemailer";
import { PushSubscription } from "../models/pushSubscription.js";

// ============= UTILITY FUNCTIONS FOR KEY VALIDATION =============
const validateAndFixKeys = (keys) => {
  try {
    // Function to ensure proper base64url encoding
    const fixBase64Url = (str) => {
      if (!str) return str;

      // Remove any padding that might exist
      let fixed = str.replace(/=/g, "");

      // Replace URL-safe characters if they were converted incorrectly
      fixed = fixed.replace(/\+/g, "-").replace(/\//g, "_");

      return fixed;
    };

    // Function to validate key length after decoding
    const validateKeyLength = (key, expectedLength, keyName) => {
      if (!key) return false;

      try {
        // Convert base64url to base64
        const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
        // Add padding if needed
        const padded =
          base64 + "==".substring(0, (4 - (base64.length % 4)) % 4);

        // Decode to get actual bytes
        const decoded = Buffer.from(padded, "base64");

        console.log(
          `🔍 ${keyName} key length: ${decoded.length} bytes (expected: ${expectedLength})`
        );

        return decoded.length === expectedLength;
      } catch (error) {
        console.error(`❌ Error validating ${keyName} key:`, error.message);
        return false;
      }
    };

    const fixedKeys = {
      p256dh: fixBase64Url(keys.p256dh),
      auth: fixBase64Url(keys.auth),
    };

    // Validate key lengths (p256dh should be 65 bytes, auth should be 16 bytes)
    const p256dhValid = validateKeyLength(fixedKeys.p256dh, 65, "p256dh");
    const authValid = validateKeyLength(fixedKeys.auth, 16, "auth");

    if (!p256dhValid || !authValid) {
      throw new Error(
        `Invalid key lengths - p256dh: ${p256dhValid}, auth: ${authValid}`
      );
    }

    return fixedKeys;
  } catch (error) {
    console.error("❌ Key validation failed:", error.message);
    throw new Error(`Invalid subscription keys: ${error.message}`);
  }
};

// ============= EMAIL CONFIGURATION =============
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

// ============= PUSH NOTIFICATION CONFIGURATION =============
webpush.setVapidDetails(
  `mailto:${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Add this to your notification service file

// ============= DEVELOPMENT MODE CONFIGURATION =============
const isDevelopment =
  process.env.NODE_ENV === "development" ||
  process.env.SKIP_PUSH_NOTIFICATIONS === "true";

// ============= MODIFIED PUSH NOTIFICATION FUNCTION =============
export const sendPushNotification = async (userId, userType, payload) => {
  try {
    // In development mode, simulate push notification without actually sending
    if (isDevelopment) {
      console.log("🚧 DEVELOPMENT MODE - Simulating push notification:");
      console.log(`📱 User: ${userId} (${userType})`);
      console.log(`📨 Payload:`, JSON.stringify(payload, null, 2));
      console.log("✅ Push notification simulated successfully");
      return {
        success: true,
        message: "Push notification simulated in development mode",
        successful: 1,
        failed: 0,
        totalSubscriptions: 1,
      };
    }

    const subscriptions = await PushSubscription.find({
      userId,
      userType,
      isActive: true,
    });

    if (subscriptions.length === 0) {
      console.log(
        `📱 No active push subscriptions found for ${userType} ${userId}`
      );
      return { success: false, message: "No active subscriptions" };
    }

    // Filter out test/dummy endpoints in production
    const validSubscriptions = subscriptions.filter((sub) => {
      const isTestEndpoint =
        sub.endpoint.includes("dummy") ||
        sub.endpoint.includes("test") ||
        sub.endpoint.includes("fake");

      if (isTestEndpoint) {
        console.log(`🚫 Skipping test endpoint: ${sub.endpoint}`);
        return false;
      }
      return true;
    });

    if (validSubscriptions.length === 0) {
      console.log("🚫 No valid (non-test) subscriptions found");
      return {
        success: false,
        message: "No valid subscriptions (test endpoints filtered out)",
        successful: 0,
        failed: 0,
        totalSubscriptions: subscriptions.length,
      };
    }

    const notifications = validSubscriptions.map(async (sub) => {
      try {
        console.log(`🔄 Processing subscription ${sub._id}`);

        // Validate and fix the subscription keys
        const validatedKeys = validateAndFixKeys(sub.keys);

        const subscription = {
          endpoint: sub.endpoint,
          keys: validatedKeys,
        };

        await webpush.sendNotification(subscription, JSON.stringify(payload));
        console.log(
          `✅ Push notification sent successfully to subscription ${sub._id}`
        );
        return { success: true, subscription: sub._id };
      } catch (error) {
        console.error(
          `❌ Failed to send push to subscription ${sub._id}:`,
          error.message
        );

        // Handle different error types
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription is no longer valid
          await PushSubscription.findByIdAndUpdate(sub._id, {
            isActive: false,
          });
          console.log(`🗑️ Deactivated invalid subscription ${sub._id}`);
        } else if (
          error.message.includes("p256dh") ||
          error.message.includes("auth")
        ) {
          // Key validation error - deactivate this subscription
          await PushSubscription.findByIdAndUpdate(sub._id, {
            isActive: false,
          });
          console.log(
            `🔑 Deactivated subscription with invalid keys ${sub._id}`
          );
        }

        return { success: false, subscription: sub._id, error: error.message };
      }
    });

    const results = await Promise.allSettled(notifications);
    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.filter(
      (r) => r.status === "rejected" || !r.value.success
    ).length;

    console.log(
      `📊 Push notification results: ${successful} sent, ${failed} failed`
    );
    return {
      success: successful > 0,
      successful,
      failed,
      totalSubscriptions: validSubscriptions.length,
    };
  } catch (error) {
    console.error("❌ Push notification error:", error);
    return { success: false, error: error.message };
  }
};
// ============= EMAIL TEMPLATES =============
const getBookingEmailTemplate = (type, data) => {
  const baseStyle = `
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background-color: #2563eb; color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px 20px; background-color: #f9fafb; }
            .message-content { background-color: white; padding: 25px; border-radius: 8px; border-left: 4px solid #2563eb; }
            .booking-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .status-accepted { background-color: #dcfce7; color: #166534; }
            .status-rejected { background-color: #fef2f2; color: #dc2626; }
            .status-completed { background-color: #dbeafe; color: #1d4ed8; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .button:hover { background-color: #1d4ed8; }
            .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; background-color: #f3f4f6; }
            .highlight { background-color: #fef3cd; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #374151; }
            .detail-value { color: #6b7280; }
        </style>
    `;

  const { booking, user, provider } = data;

  switch (type) {
    case "booking_accepted":
      const getServiceDate = () => {
        const dateField = booking.scheduledDateTime;
        if (!dateField) return "Date to be confirmed";

        try {
          return new Date(dateField).toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        } catch (error) {
          return "Invalid date";
        }
      };

      const getServiceTime = () => {
        const dateField = booking.scheduledDateTime;
        if (!dateField) return "Time to be confirmed";

        try {
          return new Date(dateField).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
        } catch (error) {
          return "Invalid time";
        }
      };

      const getBookingId = () => {
        return booking._id
          ? booking._id.toString().slice(-8).toUpperCase()
          : "N/A";
      };
      return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Booking Accepted - Service Confirmed</title>
                    ${baseStyle}
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎉 Great News!</h1>
                            <h2>Your Booking Has Been Accepted</h2>
                        </div>
                        <div class="content">
                            <div class="message-content">
                                <h2>Hi ${user.name},</h2>
                                <p>Excellent news! <strong>${
                                  provider.businessName
                                }</strong> has accepted your booking request.</p>
                                
                                <div class="booking-card">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                        <h3 style="margin: 0; color: #1f2937;">Booking Details</h3>
                                        <span class="status-badge status-accepted">Accepted</span>
                                    </div>
                                    
                                    <div class="detail-row">
                                        <span class="detail-label">Booking ID:</span>
                                        <span class="detail-value">#${getBookingId()}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Service Provider:</span>
                                        <span class="detail-value">${
                                          provider.businessName
                                        }</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Provider Contact:</span>
                                        <span class="detail-value">${
                                          provider.phone
                                        }</span>
                                    </div>
                                     <div class="detail-row">
                                <span class="detail-label">Service Date:</span>
                                <span class="detail-value">${getServiceDate()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Service Time:</span>
                                <span class="detail-value">${getServiceTime()}</span>
                            </div>
                                    ${
                                      booking.totalAmount
                                        ? `
                                    <div class="detail-row">
                                        <span class="detail-label">Total Amount:</span>
                                        <span class="detail-value">₹${booking.totalAmount}</span>
                                    </div>
                                    `
                                        : ""
                                    }
                                </div>
                                
                                <div class="highlight">
                                    <h4>📞 Next Steps:</h4>
                                    <ul>
                                        <li>The service provider will contact you on <strong>${
                                          user.phone
                                        }</strong> to confirm details</li>
                                        <li>Please ensure you're available at the scheduled time</li>
                                        <li>Keep your contact number active for any updates</li>
                                        <li>You can contact the provider directly at <strong>${
                                          provider.phone
                                        }</strong></li>
                                    </ul>
                                </div>
                                
                                <div style="text-align: center;">
                                    <a href="${
                                      process.env.FRONTEND_URL
                                    }/bookings/${
        booking._id
      }" class="button">📱 View Booking Details</a>
                                </div>
                                
                                <p><strong>Important:</strong> If you need to reschedule or have any questions, please contact the service provider directly or reach out to our support team.</p>
                            </div>
                        </div>
                        <div class="footer">
                            <p>© 2025 LocalHands. All rights reserved.</p>
                            <p>Need help? Contact us at support@localhands.com</p>
                            <p>Booking ID: #${booking._id
                              .toString()
                              .slice(-8)
                              .toUpperCase()}</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

    case "booking_rejected":
      return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Booking Update - Alternative Options Available</title>
                    ${baseStyle}
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📋 Booking Update</h1>
                            <h2>Let's Find You Another Provider</h2>
                        </div>
                        <div class="content">
                            <div class="message-content">
                                <h2>Hi ${user.name},</h2>
                                <p>We wanted to update you about your recent booking request with <strong>${provider.businessName}</strong>.</p>
                                
                                <div class="booking-card">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                        <h3 style="margin: 0; color: #1f2937;">Booking Status</h3>
                                        <span class="status-badge status-rejected">Not Available</span>
                                    </div>
                                    
                                    <p>Unfortunately, the provider is not available for your requested date and time. This can happen due to:</p>
                                    <ul>
                                        <li>Provider's schedule conflict</li>
                                        <li>Service area limitations</li>
                                        <li>High demand during peak hours</li>
                                    </ul>
                                </div>
                                
                                <div class="highlight">
                                    <h4>🔍 Don't Worry - We've Got Alternatives!</h4>
                                    <p>We have many other qualified service providers in your area who can help you.</p>
                                </div>
                                
                                <div style="text-align: center;">
                                    <a href="${process.env.FRONTEND_URL}/search?category=${booking.category}" class="button">🔎 Find Similar Providers</a>
                                </div>
                                
                                <p><strong>Pro Tip:</strong> Try booking for different time slots or consider flexible dates to increase your chances of quick acceptance.</p>
                            </div>
                        </div>
                        <div class="footer">
                            <p>© 2025 LocalHands. All rights reserved.</p>
                            <p>Need help finding the right provider? Contact us at support@localhands.com</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

    case "booking_completed":
      return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Service Completed - Please Share Your Experience</title>
                    ${baseStyle}
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✅ Service Completed</h1>
                            <h2>How Was Your Experience?</h2>
                        </div>
                        <div class="content">
                            <div class="message-content">
                                <h2>Hi ${user.name},</h2>
                                <p>Your service with <strong>${
                                  provider.businessName
                                }</strong> has been marked as completed.</p>
                                
                                <div class="booking-card">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                        <h3 style="margin: 0; color: #1f2937;">Service Summary</h3>
                                        <span class="status-badge status-completed">Completed</span>
                                    </div>
                                    
                                    <div class="detail-row">
                                        <span class="detail-label">Service Provider:</span>
                                        <span class="detail-value">${
                                          provider.businessName
                                        }</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Completed On:</span>
                                        <span class="detail-value">${new Date().toLocaleDateString(
                                          "en-IN"
                                        )}</span>
                                    </div>
                                </div>
                                
                                <div class="highlight">
                                    <h4>⭐ Your Feedback Matters!</h4>
                                    <p>Please take a moment to rate and review your experience. Your feedback helps other users make informed decisions and helps service providers improve.</p>
                                </div>
                                
                                <div style="text-align: center;">
                                    <a href="${
                                      process.env.FRONTEND_URL
                                    }/bookings/${
        booking._id
      }/review" class="button">⭐ Rate & Review</a>
                                </div>
                                
                                <p>Thank you for choosing LocalHands for your service needs!</p>
                            </div>
                        </div>
                        <div class="footer">
                            <p>© 2025 LocalHands. All rights reserved.</p>
                            <p>Questions about your service? Contact support@localhands.com</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

    // Add these cases to your getBookingEmailTemplate function switch statement

    case "booking_rescheduled_by_user":
      const { oldDateTime: oldTimeUser, newDateTime: newTimeUser } = data;

      return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Booking Rescheduled - Customer Update</title>
        ${baseStyle}
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📅 Booking Rescheduled</h1>
                <h2>Customer has Updated the Schedule</h2>
            </div>
            <div class="content">
                <div class="message-content">
                    <h2>Hi ${provider.businessName},</h2>
                    <p><strong>${
                      user.name
                    }</strong> has rescheduled their booking with you.</p>
                    
                    <div class="booking-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0; color: #1f2937;">Schedule Update</h3>
                            <span class="status-badge" style="background-color: #fef3cd; color: #92400e;">Rescheduled</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">Customer:</span>
                            <span class="detail-value">${user.name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Customer Contact:</span>
                            <span class="detail-value">${user.phone}</span>
                        </div>
                        <div class="detail-row" style="background-color: #fee2e2;">
                            <span class="detail-label">Previous Date & Time:</span>
                            <span class="detail-value">${new Date(
                              oldTimeUser
                            ).toLocaleString("en-IN")}</span>
                        </div>
                        <div class="detail-row" style="background-color: #dcfce7;">
                            <span class="detail-label">New Date & Time:</span>
                            <span class="detail-value">${new Date(
                              newTimeUser
                            ).toLocaleString("en-IN")}</span>
                        </div>
                    </div>
                    
                    <div class="highlight">
                        <h4>📞 Action Required:</h4>
                        <ul>
                            <li>Please confirm your availability for the new time slot</li>
                            <li>Contact the customer at <strong>${
                              user.phone
                            }</strong> if needed</li>
                            <li>Update your schedule accordingly</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="${
                          process.env.FRONTEND_URL
                        }/provider/bookings/${
        booking._id
      }" class="button">📱 View Booking Details</a>
                    </div>
                </div>
            </div>
            <div class="footer">
                <p>© 2025 LocalHands. All rights reserved.</p>
                <p>Questions? Contact support@localhands.com</p>
            </div>
        </div>
    </body>
    </html>
  `;

    case "booking_rescheduled_by_provider":
      const { oldDateTime: oldTimeProv, newDateTime: newTimeProv } = data;

      return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Booking Rescheduled - Provider Update</title>
        ${baseStyle}
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📅 Booking Rescheduled</h1>
                <h2>Your Service Time Has Been Updated</h2>
            </div>
            <div class="content">
                <div class="message-content">
                    <h2>Hi ${user.name},</h2>
                    <p><strong>${
                      provider.businessName
                    }</strong> has rescheduled your booking to a new time slot.</p>
                    
                    <div class="booking-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0; color: #1f2937;">Updated Schedule</h3>
                            <span class="status-badge" style="background-color: #fef3cd; color: #92400e;">Rescheduled</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">Service Provider:</span>
                            <span class="detail-value">${
                              provider.businessName
                            }</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Provider Contact:</span>
                            <span class="detail-value">${provider.phone}</span>
                        </div>
                        <div class="detail-row" style="background-color: #fee2e2;">
                            <span class="detail-label">Previous Date & Time:</span>
                            <span class="detail-value">${new Date(
                              oldTimeProv
                            ).toLocaleString("en-IN")}</span>
                        </div>
                        <div class="detail-row" style="background-color: #dcfce7;">
                            <span class="detail-label">New Date & Time:</span>
                            <span class="detail-value">${new Date(
                              newTimeProv
                            ).toLocaleString("en-IN")}</span>
                        </div>
                    </div>
                    
                    <div class="highlight">
                        <h4>✅ What's Next:</h4>
                        <ul>
                            <li>Please ensure you're available at the new scheduled time</li>
                            <li>The provider will contact you to confirm details</li>
                            <li>If you have any concerns, contact the provider directly</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="${process.env.FRONTEND_URL}/bookings/${
        booking._id
      }" class="button">📱 View Updated Booking</a>
                    </div>
                    
                    <p><strong>Note:</strong> If the new time doesn't work for you, please contact the provider immediately at <strong>${
                      provider.phone
                    }</strong>.</p>
                </div>
            </div>
            <div class="footer">
                <p>© 2025 LocalHands. All rights reserved.</p>
                <p>Need help? Contact us at support@localhands.com</p>
            </div>
        </div>
    </body>
    </html>
  `;

    default:
      return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>LocalHands Notification</title>
                    ${baseStyle}
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>LocalHands</h1>
                        </div>
                        <div class="content">
                            <div class="message-content">
                                <h2>Hi ${user.name},</h2>
                                <p>You have a new update regarding your booking.</p>
                            </div>
                        </div>
                        <div class="footer">
                            <p>© 2025 LocalHands. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
  }
};

// ============= EMAIL NOTIFICATION FUNCTIONS =============
export const sendEmailNotification = async (
  to,
  subject,
  templateType,
  templateData
) => {
  const transporter = createTransporter();

  try {
    const htmlContent = getBookingEmailTemplate(templateType, templateData);

    const mailOptions = {
      from: `${process.env.FROM_NAME || "LocalHands"} <${
        process.env.FROM_EMAIL || process.env.SMTP_EMAIL
      }>`,
      to: to,
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
};

// ============= UNIFIED NOTIFICATION FUNCTION =============
export const sendBookingNotification = async (
  notificationType,
  bookingData
) => {
  const { booking, user, provider } = bookingData;
  const results = { push: null, email: null };

  const notificationConfig = {
    booking_accepted: {
      push: {
        title: "🎉 Booking Accepted!",
        body: `${provider.businessName} has accepted your booking`,
        icon: "/icons/booking-accepted.png",
        badge: "/icons/badge.png",
        data: {
          bookingId: booking._id,
          type: "booking_accepted",
          url: `/bookings/${booking._id}`,
        },
      },
      email: {
        subject: "Booking Accepted - Service Confirmed",
        template: "booking_accepted",
      },
    },
    booking_rejected: {
      push: {
        title: "📋 Booking Update",
        body: `${provider.businessName} is not available. Let's find you another provider!`,
        icon: "/icons/booking-rejected.png",
        badge: "/icons/badge.png",
        data: {
          bookingId: booking._id,
          type: "booking_rejected",
          url: `/search?category=${booking.category}`,
        },
      },
      email: {
        subject: "Booking Update - Alternative Options Available",
        template: "booking_rejected",
      },
    },
    booking_completed: {
      push: {
        title: "✅ Service Completed",
        body: "How was your experience? Please rate and review!",
        icon: "/icons/booking-completed.png",
        badge: "/icons/badge.png",
        data: {
          bookingId: booking._id,
          type: "booking_completed",
          url: `/bookings/${booking._id}/review`,
        },
      },
      email: {
        subject: "Service Completed - Please Share Your Experience",
        template: "booking_completed",
      },
    },
    booking_rescheduled_by_user: {
      push: {
        title: "📅 Booking Rescheduled",
        body: `A customer has rescheduled their booking`,
        icon: "/icons/booking-rescheduled.png",
        badge: "/icons/badge.png",
        data: {
          bookingId: booking._id,
          type: "booking_rescheduled",
          url: `/bookings/${booking._id}`,
        },
      },
      email: {
        subject: "Booking Rescheduled - Updated Time Slot",
        template: "booking_rescheduled_by_user",
      },
    },
    booking_rescheduled_by_provider: {
      push: {
        title: "📅 Booking Rescheduled",
        body: `${provider.businessName} has rescheduled your booking`,
        icon: "/icons/booking-rescheduled.png",
        badge: "/icons/badge.png",
        data: {
          bookingId: booking._id,
          type: "booking_rescheduled",
          url: `/bookings/${booking._id}`,
        },
      },
      email: {
        subject: "Booking Rescheduled by Provider - New Time Confirmed",
        template: "booking_rescheduled_by_provider",
      },
    },
  };

  const config = notificationConfig[notificationType];
  if (!config) {
    throw new Error(`Unknown notification type: ${notificationType}`);
  }

  try {
    // Send Push Notification
    if (user.preferences?.notifications?.push) {
      results.push = await sendPushNotification(user._id, "user", config.push);
    } else {
      results.push = {
        success: false,
        message: "Push notifications disabled by user",
      };
    }

    // Send Email Notification
    if (user.preferences?.notifications?.email) {
      results.email = await sendEmailNotification(
        user.email,
        config.email.subject,
        config.email.template,
        { booking, user, provider }
      );
    } else {
      results.email = {
        success: false,
        message: "Email notifications disabled by user",
      };
    }

    console.log(`📨 Notification sent for ${notificationType}:`, {
      push: results.push?.success ? "Success" : "Failed/Disabled",
      email: results.email?.success ? "Success" : "Failed/Disabled",
    });

    return results;
  } catch (error) {
    console.error(`❌ Error sending ${notificationType} notification:`, error);
    throw error;
  }
};

// ============= LEGACY EMAIL FUNCTION (For backward compatibility) =============
export const sendEmail = async (options) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `${process.env.FROM_NAME || "LocalHands"} <${
      process.env.FROM_EMAIL || process.env.SMTP_EMAIL
    }>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || `<p>${options.message.replace(/\n/g, "<br>")}</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};

// ============= UTILITY FUNCTIONS =============
export const sendBulkEmail = async (emailList, subject, message) => {
  const promises = emailList.map((email) =>
    sendEmail({ email, subject, message })
  );

  try {
    const results = await Promise.allSettled(promises);
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`📊 Bulk email results: ${successful} sent, ${failed} failed`);
    return { successful, failed, results };
  } catch (error) {
    console.error("❌ Bulk email error:", error);
    throw error;
  }
};

// ============= CLEANUP FUNCTION =============
export const cleanupInvalidSubscriptions = async () => {
  try {
    const result = await PushSubscription.deleteMany({ isActive: false });
    console.log(`🗑️ Cleaned up ${result.deletedCount} invalid subscriptions`);
    return result;
  } catch (error) {
    console.error("❌ Error cleaning up subscriptions:", error);
    throw error;
  }
};

export default {
  sendPushNotification,
  sendEmailNotification,
  sendBookingNotification,
  sendEmail,
  sendBulkEmail,
  cleanupInvalidSubscriptions,
};
