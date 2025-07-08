import nodemailer from 'nodemailer';

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });
};

// Enhanced email templates
const getEmailTemplate = (subject, message) => {
    const baseStyle = `
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background-color: #2563eb; color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px 20px; background-color: #f9fafb; }
            .message-content { background-color: white; padding: 25px; border-radius: 8px; border-left: 4px solid #2563eb; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .button:hover { background-color: #1d4ed8; }
            .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; background-color: #f3f4f6; }
            .warning { background-color: #fef3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .verification-url { background-color: #e5e7eb; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 10px 0; }
        </style>
    `;

    // Detect if this is a verification email
    const isVerificationEmail = subject.toLowerCase().includes('verification') || message.includes('verify');
    const isProviderEmail = subject.toLowerCase().includes('provider');
    const isPasswordReset = subject.toLowerCase().includes('reset') || subject.toLowerCase().includes('password');
    
    // Extract verification URL from message
    const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
    const verificationUrl = urlMatch ? urlMatch[0] : null;
    
    // Extract name if present (assuming format like "Hi [Name]" or "Welcome [Name]")
    const nameMatch = message.match(/(?:Hi|Hello|Welcome)\s+([A-Za-z\s]+)(?:[,!]|$)/);
    const extractedName = nameMatch ? nameMatch[1].trim() : 'User';

    if (isVerificationEmail) {
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${subject}</title>
                ${baseStyle}
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Welcome to LocalHands!</h1>
                        ${isProviderEmail ? '<h2>Service Provider Platform</h2>' : '<h2>Your Neighborhood Service Directory</h2>'}
                    </div>
                    <div class="content">
                        <div class="message-content">
                            <h2>Hi ${extractedName},</h2>
                            ${isProviderEmail ? 
                                '<p>Welcome to LocalHands as a Service Provider! We\'re excited to have you join our platform and connect with local customers.</p>' :
                                '<p>Thank you for joining LocalHands - your trusted neighborhood service provider platform!</p>'
                            }
                            
                            <p>To complete your registration and ${isProviderEmail ? 'start receiving booking requests' : 'start exploring services in your area'}, please verify your email address:</p>
                            
                            ${verificationUrl ? `
                                <div style="text-align: center;">
                                    <a href="${verificationUrl}" class="button">✅ Verify Email Address</a>
                                </div>
                            ` : ''}
                            
                            <div class="warning">
                                <strong>⏰ Important:</strong> This verification link will expire in 24 hours for security purposes.
                            </div>
                            
                            ${isProviderEmail ? `
                                <h3>📋 Next Steps After Verification:</h3>
                                <ol>
                                    <li><strong>Complete KYC Documentation</strong> - Upload Aadhar and PAN for verification</li>
                                    <li><strong>Set Up Services</strong> - Add your service categories and pricing</li>
                                    <li><strong>Define Service Areas</strong> - Set your working locations</li>
                                    <li><strong>Upload Portfolio</strong> - Showcase your best work</li>
                                    <li><strong>Wait for Approval</strong> - Our team will review your profile</li>
                                </ol>
                                
                                <h3>🚀 Once Approved, You Can:</h3>
                                <ul>
                                    <li>Receive booking requests from local customers</li>
                                    <li>Build your reputation with genuine reviews</li>
                                    <li>Manage your schedule and availability</li>
                                    <li>Track earnings and get timely payouts</li>
                                </ul>
                            ` : `
                                <h3>🔍 What You Can Do:</h3>
                                <ul>
                                    <li>Browse and review local service providers</li>
                                    <li>Book trusted electricians, plumbers, maids, and more</li>
                                    <li>Read genuine reviews from your neighbors</li>
                                    <li>Get quick responses from verified professionals</li>
                                </ul>
                            `}
                            
                            <p>If you didn't create this account, please ignore this email.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2025 LocalReviews. All rights reserved.</p>
                        ${verificationUrl ? `
                            <p>Having trouble with the button? Copy and paste this link:</p>
                            <div class="verification-url">${verificationUrl}</div>
                        ` : ''}
                        <p>Need help? Contact us at support@localreviews.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    } else if (isPasswordReset) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${subject}</title>
                ${baseStyle}
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <div class="message-content">
                            <h2>Welcome ${extractedName},</h2>
                            <p>We received a request to reset your password for your LocalReviews account.</p>
                            
                            ${verificationUrl ? `
                                <div style="text-align: center;">
                                    <a href="${verificationUrl}" class="button">🔑 Reset Password</a>
                                </div>
                            ` : ''}
                            
                            <div class="warning">
                                <strong>⏰ Security Notice:</strong> This reset link will expire in 15 minutes for your security.
                            </div>
                            
                            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                            
                            <p><strong>Security Tips:</strong></p>
                            <ul>
                                <li>Choose a strong password with mix of letters, numbers, and symbols</li>
                                <li>Don't reuse passwords from other accounts</li>
                                <li>Consider using a password manager</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2025 LocalReviews. All rights reserved.</p>
                        ${verificationUrl ? `
                            <p>Having trouble with the button? Copy and paste this link:</p>
                            <div class="verification-url">${verificationUrl}</div>
                        ` : ''}
                    </div>
                </div>
            </body>
            </html>
        `;
    } else {
        // Generic professional template for other emails
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${subject}</title>
                ${baseStyle}
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>LocalReviews</h1>
                    </div>
                    <div class="content">
                        <div class="message-content">
                            ${message.split('\n').map(line => {
                                if (line.trim().startsWith('http')) {
                                    return `<div style="text-align: center; margin: 20px 0;"><a href="${line.trim()}" class="button">Click Here</a></div>`;
                                }
                                return line.trim() ? `<p>${line}</p>` : '<br>';
                            }).join('')}
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2025 LocalReviews. All rights reserved.</p>
                        <p>Need help? Contact us at support@localreviews.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
};

// Main sendEmail function - matches your existing interface
export const sendEmail = async (options) => {
    const transporter = createTransporter();

    // Generate HTML content from the message
    const htmlContent = getEmailTemplate(options.subject, options.message);

    const mailOptions = {
        from: `${process.env.FROM_NAME || 'LocalHands'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message, // Plain text fallback
        html: htmlContent // Rich HTML version
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        throw error;
    }
};

// Additional utility functions (optional - for future use)
export const sendBulkEmail = async (emailList, subject, message) => {
    const promises = emailList.map(email => 
        sendEmail({ email, subject, message })
    );
    
    try {
        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`📊 Bulk email results: ${successful} sent, ${failed} failed`);
        return { successful, failed, results };
    } catch (error) {
        console.error('❌ Bulk email error:', error);
        throw error;
    }
};

export const sendNotificationEmail = async (userEmail, title, message, actionUrl = null) => {
    let emailMessage = message;
    if (actionUrl) {
        emailMessage += `\n\n${actionUrl}`;
    }
    
    return await sendEmail({
        email: userEmail,
        subject: `LocalReviews - ${title}`,
        message: emailMessage
    });
};

export default sendEmail;