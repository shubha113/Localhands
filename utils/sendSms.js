import twilio from 'twilio';
import dotenv from 'dotenv'

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

// Helper function to format phone number
const formatPhoneNumber = (phoneNumber) => {
    return phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
};

// Function to generate OTP
export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
};

// Complete sendSMS function with added error logging
export const sendSMS = async (phoneNumber, message) => {
    const formattedPhoneNumber = formatPhoneNumber(String(phoneNumber));

    try {
        // Sending SMS via Twilio
        const response = await client.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: formattedPhoneNumber,
        });
        
        console.log(`OTP sent successfully to ${formattedPhoneNumber}`);
        return response;
    } catch (error) {
        console.error(
            `Error sending SMS to ${formattedPhoneNumber}: ${error.message}`,
            error.code,
            error.moreInfo
        );

        // Handle specific Twilio error for unverified numbers (error code 21608)
        if (error.code === 21608) {
            throw new Error(
                'The number is not verified. Please verify the number in your Twilio dashboard.'
            );
        }

        // Generic error handling
        throw new Error('Failed to send OTP. Please try again later.');
    }
};