import express from 'express'
import EmailTemplate from '../models/EmailTemplate.js'
import EmailSettings from '../models/EmailSettings.js'
import { testSMTPConnection } from '../services/emailService.js'
import { getPublicWebUrl, getSupportEmailFallback } from '../config/siteUrls.js'

const router = express.Router()

// Common footer with regulatory text - Dark theme
const getEmailFooter = () => {
  const web = getPublicWebUrl()
  return `
    <!-- App Download Section -->
    <div style="text-align: center; margin: 30px 0 20px 0;">
      <p style="color: #aaa; font-size: 14px; margin: 0 0 15px 0;">Trade via our <span style="color: #3b82f6; font-weight: bold;">BULL4X</span> iOS or Android App</p>
      <table align="center" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 0 8px;">
            <a href="#" style="text-decoration: none;">
              <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" style="height: 60px; border: 0; display: block;">
            </a>
          </td>
          <td style="padding: 0 8px;">
            <a href="#" style="text-decoration: none;">
              <img src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83" alt="Download on the App Store" style="height: 40px; border: 0; display: block;">
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Social Media Icons -->
    <div style="text-align: center; margin: 20px 0; padding: 15px 0;">
      <a href="${web}" style="display: inline-block; margin: 0 8px; text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" style="width: 36px; height: 36px; border: 0;">
      </a>
      <a href="${web}" style="display: inline-block; margin: 0 8px; text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/512/2111/2111646.png" alt="Telegram" style="width: 36px; height: 36px; border: 0;">
      </a>
      <a href="${web}" style="display: inline-block; margin: 0 8px; text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" alt="Instagram" style="width: 36px; height: 36px; border: 0;">
      </a>
      <a href="${web}" style="display: inline-block; margin: 0 8px; text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" style="width: 36px; height: 36px; border: 0;">
      </a>
    </div>

    <!-- Trading Categories -->
    <div style="text-align: center; margin: 20px 0;">
      <p style="color: #ffffff; font-size: 12px; margin: 0;">
        CFDs on <span style="color: #ffffff;">INDICES</span> | <span style="color: #ffffff;">SHARES</span> | <span style="color: #ffffff;">FOREX</span> | <span style="color: #ffffff;">COMMODITIES</span>
      </p>
      <p style="color: #ffffff; font-size: 12px; margin: 5px 0 0 0;">
        <a href="${web}/legal" style="color: #ffffff; text-decoration: none;">Legal Documents</a> | 
        <a href="${web}/privacy-policy" style="color: #ffffff; text-decoration: none;">Privacy Policy</a>
      </p>
    </div>

    <!-- Banner Section with Email Banner Image -->
    <div style="text-align: center; margin: 25px 0;">
      <a href="${web}" style="display: block; text-decoration: none;">
        <img src="${web}/email_banner.png" alt="BULL4X" style="max-width: 100%; width: 100%; height: auto; border-radius: 8px; display: block; border: 0;">
      </a>
    </div>

    <!-- Regulatory Footer -->
    <div style="background-color: #0f0f1a; padding: 25px 20px; margin-top: 20px; border-top: 1px solid #333;">
      <p style="color: #888; font-size: 11px; line-height: 1.6; margin: 0 0 15px 0; text-align: justify;">
        <strong style="color: #aaa;">Risk Warning:</strong> FX and CFDs are leveraged products and involve a high level of risk. Trading may result in losses exceeding your initial investment and may not be suitable for all investors. Please ensure you fully understand the risks before trading. Past performance is not indicative of future results.
      </p>
      
      <p style="color: #888; font-size: 11px; line-height: 1.6; margin: 0 0 15px 0; text-align: justify;">
        <strong style="color: #aaa;">Disclaimer:</strong> The information on this website is provided for general informational purposes only and does not take into account your investment objectives or financial situation. Access to this website is at your own initiative. BULL4X Ltd makes no representations or warranties as to the accuracy or completeness of the content and accepts no liability for any reliance placed on it.
      </p>
      
      <p style="color: #888; font-size: 11px; line-height: 1.6; margin: 0; text-align: justify;">
        <strong style="color: #aaa;">Regulatory Notice:</strong> Services are offered by BULL4X and related group entities as disclosed in your jurisdiction. Where applicable, BULL4X Europe Limited is authorised and regulated as an Investment Firm by the Cyprus Securities and Exchange Commission (licence number Z157892L).
      </p>
    </div>
`
}

// Email wrapper template - Dark theme
const wrapEmailContent = (content) => {
  const web = getPublicWebUrl()
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BULL4X</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a14; font-family: Arial, Helvetica, sans-serif;">
  <!-- Outer wrapper for full background -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0a0a14; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main email container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; border: 1px solid #333;">
          <!-- Header with Logo -->
          <tr>
            <td style="text-align: center; padding: 30px 20px; border-bottom: 1px solid #333;">
              <img src="${web}/logo.png" alt="BULL4X" style="max-width: 200px; height: auto;">
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 40px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td>
              ${getEmailFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Default email templates - Professional Vantage-style design
const defaultTemplates = [
  {
    name: 'Admin/Employee Login OTP',
    slug: 'admin_login_otp',
    subject: 'Your Login OTP Code - BULL4X',
    description: 'Sent when admin or employee logs in to verify with OTP',
    category: 'verification',
    variables: ['otp', 'firstName', 'email', 'expiryMinutes', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We received a request to log in to your BULL4X admin account.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
        For your security, please use the One-Time Password (OTP) below:
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 8px 0;">OTP</p>
      <p style="color: #f59e0b; font-size: 24px; letter-spacing: 6px; margin: 0 0 16px 0; font-weight: 700;">{{otp}}</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 24px 0;">This OTP will expire in {{expiryMinutes}} minutes.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">If you did not request this login, please ignore this email or contact support.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X, Security Team</p>
    `)
  },
  {
    name: 'Email Verification OTP',
    slug: 'email_verification',
    subject: 'Verify Your Email - BULL4X',
    description: 'Sent when a user registers to verify their email with OTP',
    category: 'verification',
    variables: ['otp', 'firstName', 'email', 'expiryMinutes', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Thank you for registering with BULL4X.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        To activate your account, please verify your email address using the verification code below.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 8px 0;">Verify email</p>
      <p style="color: #4ade80; font-size: 24px; letter-spacing: 6px; margin: 0 0 12px 0; font-weight: 700;">{{otp}}</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 20px 0;">This code will expire in {{expiryMinutes}} minutes.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">If you did not create an account with us, please ignore this email.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X, Security Team</p>
    `)
  },
  {
    name: 'Challenge Completed',
    slug: 'challenge_completed',
    subject: 'Congratulations - Challenge Passed - BULL4X',
    description: 'Sent when a user successfully completes a trading challenge',
    category: 'challenge',
    variables: ['firstName', 'challengeName', 'fundSize', 'accountId', 'completionDate', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;"><strong style="color:#e5e7eb;">Congratulations!</strong></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We are pleased to inform you that you have successfully progressed in your Funded Trading Challenge on BULL4X (<strong>{{challengeName}}</strong>).
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your trading performance has met the required evaluation criteria, and your account is under review for the next stage.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Challenge account details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Account ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right; font-weight: 600;">{{accountId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Evaluation period</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{completionDate}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Fund / balance reference</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right; font-weight: 600;">{{fundSize}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
        Our team will complete the verification process shortly and notify you once your funded stage is updated.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Thank you for your dedication and disciplined trading. We look forward to your continued success with BULL4X.
      </p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">Login here</a>
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 6px 0 0 0;">Funding Evaluation Team</p>
      <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">${getSupportEmailFallback()}</p>
    `)
  },
  {
    name: 'Challenge Failed',
    slug: 'challenge_failed',
    subject: 'Challenge Result - BULL4X',
    description: 'Sent when a user fails a trading challenge',
    category: 'challenge',
    variables: ['firstName', 'challengeName', 'fundSize', 'accountId', 'failureReason', 'failureDate', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We regret to inform you that your Funded Trading Challenge (<strong>{{challengeName}}</strong>) has ended and did not meet the required trading conditions.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        As a result, the challenge account has been closed according to our program rules.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Account details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 12px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Challenge account ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right; font-weight: 600;">{{accountId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Evaluation period</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{failureDate}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Reason</td>
          <td style="padding: 8px 0; color: #fca5a5; font-size: 14px; text-align: right;">{{failureReason}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        You are welcome to participate again by purchasing a new challenge and continuing your trading journey with us.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Start a new challenge</p>
      <p style="margin: 0 0 20px 0;"><a href="{{loginUrl}}" style="color: #38bdf8; font-weight: 600; word-break: break-all;">{{loginUrl}}</a></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">If you have any questions, please contact our support team.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 6px 0 0 0;">Support Team</p>
    `)
  },
  {
    name: 'Password Reset',
    slug: 'password_reset',
    subject: 'Password Reset OTP - BULL4X',
    description: 'Sent when user requests password reset',
    category: 'security',
    variables: ['firstName', 'email', 'otp', 'expiryMinutes', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We have received a request to reset the password for your BULL4X account
        (<a href="mailto:{{email}}" style="color: #60a5fa; text-decoration: none;">{{email}}</a>).
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">Your One Time Password (OTP) is:</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 16px 0 8px 0;">OTP</p>
      <p style="color: #60a5fa; font-size: 24px; letter-spacing: 6px; margin: 0 0 16px 0; font-weight: 700;">{{otp}}</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 24px 0;">This OTP will expire in {{expiryMinutes}} minutes.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        If you did not request this change, please contact our support team immediately.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X, Security Team</p>
      <p style="color: #6b7280; font-size: 13px; margin: 6px 0 0 0;">${getSupportEmailFallback()}</p>
    `)
  },
  {
    name: 'Welcome Email',
    slug: 'welcome',
    subject: 'Welcome to BULL4X - Your Trading Account is Ready',
    description: 'Sent after successful email verification',
    category: 'account',
    variables: ['firstName', 'email', 'accountId', 'accountType', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">Welcome to BULL4X.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your trading account has been successfully created on our platform. We are excited to have you joined in our global trading community.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Account details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Account ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right; font-weight: 600;">{{accountId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Email</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{email}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Account type</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{accountType}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        You can now log in to your client dashboard and start exploring our services including Forex trading and funded account opportunities.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Login here</p>
      <p style="margin: 0 0 24px 0;"><a href="{{loginUrl}}" style="color: #38bdf8; font-weight: 600; word-break: break-all;">{{loginUrl}}</a></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        If you need any assistance, our support team is always ready to help.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X, Support Team</p>
      <p style="color: #6b7280; font-size: 13px; margin: 8px 0 0 0;">Email: ${getSupportEmailFallback()}</p>
      <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Website: ${getPublicWebUrl().replace(/^https?:\/\//, '')}</p>
    `)
  },
  {
    name: 'Deposit Pending',
    slug: 'deposit_pending',
    subject: 'Deposit Request Submitted - BULL4X',
    description: 'Sent when a deposit is pending admin approval',
    category: 'transaction',
    variables: ['firstName', 'amount', 'transactionId', 'paymentMethod', 'date', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your deposit request has been successfully submitted.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Deposit details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Transaction ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 13px; text-align: right; font-family: monospace;">{{transactionId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Amount</td>
          <td style="padding: 8px 0; color: #4ade80; font-size: 16px; text-align: right; font-weight: 700;">\${{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Payment method</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{paymentMethod}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{date}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Our finance team will verify the transaction shortly. Once confirmed, the funds will be credited to your trading account.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Thank you for choosing BULL4X.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">Finance Department</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0 0;">BULL4X</p>
    `)
  },
  {
    name: 'Deposit Success',
    slug: 'deposit_success',
    subject: 'Deposit Successful - Funds Credited to Your Account',
    description: 'Sent when a deposit is successfully processed',
    category: 'transaction',
    variables: ['firstName', 'amount', 'transactionId', 'accountId', 'paymentMethod', 'date', 'newBalance', 'dashboardUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;"><strong style="color:#e5e7eb;">Good news!</strong></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your deposit has been successfully credited to your BULL4X trading account.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Transaction details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Transaction ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 13px; text-align: right; font-family: monospace;">{{transactionId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Amount credited</td>
          <td style="padding: 8px 0; color: #4ade80; font-size: 16px; text-align: right; font-weight: 700;">\${{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Account ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{accountId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{date}}</td>
        </tr>
      </table>
      <p style="color: #9ca3af; font-size: 13px; margin: 0 0 16px 0;">Wallet balance after credit: <strong style="color:#e5e7eb;">\${{newBalance}}</strong></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">You can now log in and start trading.</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 16px 0 8px 0;">Login here</p>
      <p style="margin: 0 0 24px 0;"><a href="{{dashboardUrl}}" style="color: #38bdf8; font-weight: 600; word-break: break-all;">{{dashboardUrl}}</a></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X, Finance Team</p>
    `)
  },
  {
    name: 'Withdrawal Pending',
    slug: 'withdrawal_pending',
    subject: 'Withdrawal Request Received - BULL4X',
    description: 'Sent when a withdrawal request is submitted',
    category: 'transaction',
    variables: ['firstName', 'amount', 'transactionId', 'paymentMethod', 'walletAddress', 'date', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We have successfully received your withdrawal request.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Withdrawal details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Request ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 13px; text-align: right; font-family: monospace;">{{transactionId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Amount</td>
          <td style="padding: 8px 0; color: #fca5a5; font-size: 16px; text-align: right; font-weight: 700;">\${{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Payment method</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{paymentMethod}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{date}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px; vertical-align: top;">Destination</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 13px; text-align: right; word-break: break-all;">{{walletAddress}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your request is currently under review by our finance team. Once approved, the funds will be transferred to your selected payment method.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">Finance Team</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0 0;">BULL4X</p>
    `)
  },
  {
    name: 'Withdrawal Success',
    slug: 'withdrawal_success',
    subject: 'Withdrawal Successful - BULL4X',
    description: 'Sent when a withdrawal is successfully processed',
    category: 'transaction',
    variables: ['firstName', 'amount', 'transactionId', 'date', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your withdrawal request has been successfully processed.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Transaction details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Withdrawal ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 13px; text-align: right; font-family: monospace;">{{transactionId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Amount</td>
          <td style="padding: 8px 0; color: #fca5a5; font-size: 16px; text-align: right; font-weight: 700;">\${{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Processed date</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{date}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        The funds should reflect in your payment account shortly depending on the payment method used.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Thank you for trading with BULL4X.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">Finance Team</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0 0;">BULL4X</p>
    `)
  },
  {
    name: 'Account Banned',
    slug: 'account_banned',
    subject: 'Account Suspended - Action Required',
    description: 'Sent when a user account is banned/suspended',
    category: 'account',
    variables: ['firstName', 'reason', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Dear {{firstName}},</p>
      
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your account has been suspended due to a violation of our terms of service.
      </p>
      
      <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 25px 0; border: 1px solid #ef4444;">
        <div style="text-align: center; margin-bottom: 15px;">
          <span style="display: inline-block; background: #ef4444; color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold;">🚫 ACCOUNT SUSPENDED</span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; color: #666;">Reason</td>
            <td style="padding: 10px 0; color: #dc2626; font-weight: bold; text-align: right;">{{reason}}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        If you believe this is an error, please contact our support team at <a href="mailto:${getSupportEmailFallback()}" style="color: #1e40af; text-decoration: none;">${getSupportEmailFallback()}</a>.
      </p>
      
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 30px 0 5px 0;">Kind regards,</p>
      <p style="color: #1e40af; font-size: 15px; font-weight: bold; margin: 0;">BULL4X</p>
    `)
  },
  {
    name: 'Account Unbanned',
    slug: 'account_unbanned',
    subject: 'Account Reactivated - Welcome Back!',
    description: 'Sent when a user account is unbanned/reactivated',
    category: 'account',
    variables: ['firstName', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Dear {{firstName}},</p>
      
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Great news! Your account has been reactivated and you can now access all features again.
      </p>
      
      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 25px 0; border: 1px solid #22c55e;">
        <div style="text-align: center;">
          <span style="display: inline-block; background: #22c55e; color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold;">✓ ACCOUNT RESTORED</span>
        </div>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: #fff; padding: 14px 40px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">Login Now</a>
      </div>
      
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 30px 0 5px 0;">Kind regards,</p>
      <p style="color: #1e40af; font-size: 15px; font-weight: bold; margin: 0;">BULL4X</p>
    `)
  },
  {
    name: 'KYC Submitted',
    slug: 'kyc_submitted',
    subject: 'KYC Documents Required',
    description: 'Sent when a user submits their KYC documents',
    category: 'verification',
    variables: ['firstName', 'email', 'documentType', 'submittedAt', 'kycLink', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        To comply with financial regulations, please ensure your KYC verification documents are complete. We have recorded your submission.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Required documents</p>
      <ul style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0; padding-left: 20px;">
        <li>Identity proof</li>
        <li>Address proof</li>
      </ul>
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 8px 0;">Submitted document type: <strong style="color:#e5e7eb;">{{documentType}}</strong></p>
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 20px 0;">Submitted at: {{submittedAt}}</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Upload / profile</p>
      <p style="margin: 0 0 24px 0;"><a href="{{kycLink}}" style="color: #38bdf8; font-weight: 600; word-break: break-all;">{{kycLink}}</a></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Thank you for your cooperation.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">BULL4X Compliance Team</p>
    `)
  },
  {
    name: 'KYC Approved',
    slug: 'kyc_approved',
    subject: 'KYC Verification Successful',
    description: 'Sent when admin approves user KYC documents',
    category: 'verification',
    variables: ['firstName', 'accountId', 'documentType', 'approvedAt', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your KYC verification has been successfully completed.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your account is now fully verified and ready for trading.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Account</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 16px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Account ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{accountId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Document type</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{documentType}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Approved at</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{approvedAt}}</td>
        </tr>
      </table>
      <p style="text-align: center; margin: 24px 0;">
        <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">Login</a>
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">BULL4X, Compliance Team</p>
    `)
  },
  {
    name: 'KYC Rejected',
    slug: 'kyc_rejected',
    subject: 'KYC Documents - Action Required',
    description: 'Sent when admin rejects user KYC documents',
    category: 'verification',
    variables: ['firstName', 'documentType', 'rejectionReason', 'rejectedAt', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We were unable to verify your KYC documents. Please review the reason below and resubmit through your profile.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Document type</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{documentType}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Reason</td>
          <td style="padding: 8px 0; color: #fca5a5; font-size: 14px; text-align: right;">{{rejectionReason}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Rejected at</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{rejectedAt}}</td>
        </tr>
      </table>
      <p style="text-align: center; margin: 24px 0;">
        <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">Resubmit documents</a>
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X, Compliance Team</p>
    `)
  },
  {
    name: 'Account Approved',
    slug: 'account_approved',
    subject: 'Your Account Has Been Approved',
    description: 'Sent when a user trading account is approved (matches email_template.txt)',
    category: 'account',
    variables: ['firstName', 'accountId', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;"><strong style="color:#e5e7eb;">Good news!</strong></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Your trading account has been successfully approved.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">You can now deposit funds and start trading.</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Account ID</p>
      <p style="color: #f3f4f6; font-size: 16px; font-weight: 600; margin: 0 0 20px 0;">{{accountId}}</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 16px 0 8px 0;">Login</p>
      <p style="margin: 0 0 24px 0;"><a href="{{loginUrl}}" style="color: #38bdf8; font-weight: 600; word-break: break-all;">{{loginUrl}}</a></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">BULL4X</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 0;">Admin Team</p>
    `)
  },
  {
    name: 'KYC Document Request',
    slug: 'kyc_document_request',
    subject: 'KYC Documents Required',
    description: 'Proactive request to upload KYC (matches email_template.txt)',
    category: 'verification',
    variables: ['firstName', 'kycLink', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        To comply with financial regulations, please upload your KYC verification documents.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Required documents</p>
      <ul style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0; padding-left: 20px;">
        <li>Identity proof</li>
        <li>Address proof</li>
      </ul>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Upload here</p>
      <p style="margin: 0 0 24px 0;"><a href="{{kycLink}}" style="color: #38bdf8; font-weight: 600; word-break: break-all;">{{kycLink}}</a></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Thank you for your cooperation.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">BULL4X Compliance Team</p>
    `)
  },
  {
    name: 'User Login OTP',
    slug: 'user_login_otp',
    subject: 'Your Login OTP Code - BULL4X',
    description: 'OTP for client user login (matches email_template.txt)',
    category: 'security',
    variables: ['firstName', 'otp', 'expiryMinutes', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We received a request to log in to your BULL4X account.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
        For your security, please use the One-Time Password (OTP) below:
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 8px 0;">OTP</p>
      <p style="color: #4ade80; font-size: 24px; letter-spacing: 6px; margin: 0 0 16px 0; font-weight: 700;">{{otp}}</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 24px 0;">This OTP will expire in {{expiryMinutes}} minutes.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">If you did not request this login, please ignore this email.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X, Security Team</p>
    `)
  },
  {
    name: 'Password Changed Successfully',
    slug: 'password_changed',
    subject: 'Password Changed Successfully',
    description: 'Sent after user successfully changes password (matches email_template.txt)',
    category: 'security',
    variables: ['firstName', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your account password has been successfully updated.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        If you did not perform this action, please contact support immediately.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X, Security Team</p>
      <p style="color: #6b7280; font-size: 13px; margin: 6px 0 0 0;">${getSupportEmailFallback()}</p>
    `)
  },
  {
    name: 'Forgot Password — Reset Link',
    slug: 'password_reset_link',
    subject: 'Reset Your Password - BULL4X',
    description: 'Password reset via link (matches email_template.txt; use when link flow is enabled)',
    category: 'security',
    variables: ['firstName', 'resetLink', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We received a request to reset your account password.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">Click the link below to create a new password.</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Reset password</p>
      <p style="margin: 0 0 24px 0;"><a href="{{resetLink}}" style="color: #38bdf8; font-weight: 600; word-break: break-all;">{{resetLink}}</a></p>
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 20px 0;">This link will expire in 30 minutes for security reasons.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">If you did not request a password reset, please ignore this email.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X, Security Team</p>
    `)
  },
  {
    name: 'Trading Account Activated',
    slug: 'trading_account_activated',
    subject: 'Trading Account Activated',
    description: 'Sent when a trading account becomes active (matches email_template.txt)',
    category: 'account',
    variables: ['firstName', 'accountId', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Your trading account is now active.</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Account ID</p>
      <p style="color: #f3f4f6; font-size: 16px; font-weight: 600; margin: 0 0 24px 0;">{{accountId}}</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">You can start trading immediately.</p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">Open dashboard</a>
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">Finance Team</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0 0;">BULL4X</p>
    `)
  },
  {
    name: 'Funded Account Challenge Started',
    slug: 'challenge_started',
    subject: 'Funded Account Challenge Started',
    description: 'Sent when a funded challenge account is activated (matches email_template.txt)',
    category: 'challenge',
    variables: ['firstName', 'accountId', 'balance', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your funded account challenge has been successfully activated.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Challenge account</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Challenge Account ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right; font-weight: 600;">{{accountId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Balance</td>
          <td style="padding: 8px 0; color: #4ade80; font-size: 14px; text-align: right; font-weight: 700;">{{balance}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Good luck with your trading challenge.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 6px 0 0 0;">Funding Evaluation Team</p>
      <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">${getSupportEmailFallback()}</p>
    `)
  },
  {
    name: 'Challenge Passed — Phase I',
    slug: 'challenge_passed_phase_1',
    subject: 'Congratulations - Challenge Passed for Phase I',
    description: 'Phase 1 funded challenge passed (matches email_template.txt)',
    category: 'challenge',
    variables: ['firstName', 'accountId', 'dateRange', 'finalBalance', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;"><strong style="color:#e5e7eb;">Congratulations!</strong></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We are pleased to inform you that you have successfully passed the Phase 1 Funded Trading Challenge on BULL4X.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your trading performance has met all the required evaluation criteria, and your account is now under review for the Funded Trader stage.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Challenge account details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Account ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right; font-weight: 600;">{{accountId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Evaluation period</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{dateRange}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Final balance</td>
          <td style="padding: 8px 0; color: #4ade80; font-size: 14px; text-align: right; font-weight: 700;">{{finalBalance}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
        Our team will complete the verification process shortly and notify you once your Funded Trading Account is activated.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Thank you for your dedication and disciplined trading. We look forward to seeing your continued success with BULL4X.
      </p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">Login here</a>
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 6px 0 0 0;">Funding Evaluation Team</p>
      <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">${getSupportEmailFallback()}</p>
    `)
  },
  {
    name: 'Challenge Passed — Phase II',
    slug: 'challenge_passed_phase_2',
    subject: 'Congratulations - Challenge Passed for Phase II',
    description: 'Phase 2 funded challenge passed (matches email_template.txt)',
    category: 'challenge',
    variables: ['firstName', 'accountId', 'dateRange', 'finalBalance', 'loginUrl', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;"><strong style="color:#e5e7eb;">Congratulations!</strong></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We are pleased to inform you that you have successfully passed the Phase 2 Funded Trading Challenge on BULL4X.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your trading performance has met all the required evaluation criteria, and your account is now under review for the Funded Trader stage.
      </p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 24px 0 12px 0; border-bottom: 1px solid #374151; padding-bottom: 8px;">Challenge account details</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Account ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right; font-weight: 600;">{{accountId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Evaluation period</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{dateRange}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Final balance</td>
          <td style="padding: 8px 0; color: #4ade80; font-size: 14px; text-align: right; font-weight: 700;">{{finalBalance}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
        Our team will complete the verification process shortly and notify you once your Funded Trading Account is activated.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Thank you for your dedication and disciplined trading. We look forward to seeing your continued success with BULL4X.
      </p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">Login here</a>
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">Best Regards,</p>
      <p style="color: #93c5fd; font-size: 15px; font-weight: 700; margin: 0;">BULL4X</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 6px 0 0 0;">Funding Evaluation Team</p>
      <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">${getSupportEmailFallback()}</p>
    `)
  },
  {
    name: 'Support Ticket Received',
    slug: 'support_ticket_received',
    subject: 'Support Ticket Received',
    description: 'Confirmation to user when a support ticket is created (matches email_template.txt)',
    category: 'support',
    variables: ['firstName', 'ticketId', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">We have received your support request.</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Ticket ID</p>
      <p style="color: #38bdf8; font-size: 18px; font-weight: 700; margin: 0 0 24px 0; font-family: monospace;">{{ticketId}}</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Our support team will respond shortly.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">BULL4X, Support Team</p>
    `)
  },
  {
    name: 'Support Ticket Resolved',
    slug: 'support_ticket_resolved',
    subject: 'Support Ticket Resolved',
    description: 'Sent when a support ticket is resolved (matches email_template.txt)',
    category: 'support',
    variables: ['firstName', 'ticketId', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Your support request has been resolved.</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Ticket ID</p>
      <p style="color: #4ade80; font-size: 18px; font-weight: 700; margin: 0 0 24px 0; font-family: monospace;">{{ticketId}}</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">If you need further assistance, feel free to contact us.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">BULL4X, Support Team</p>
    `)
  },
  {
    name: 'IB Commission Credited',
    slug: 'ib_commission_credited',
    subject: 'IB Commission Credited',
    description: 'When IB commission is credited (matches email_template.txt)',
    category: 'ib',
    variables: ['firstName', 'amount', 'date', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Your IB commission has been credited.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Amount</td>
          <td style="padding: 8px 0; color: #4ade80; font-size: 16px; text-align: right; font-weight: 700;">\${{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{date}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Thank you for being a valued partner.</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">BULL4X, Partner Program</p>
    `)
  },
  {
    name: 'IB Partner Registration Approved',
    slug: 'ib_partner_approved',
    subject: 'IB Partner Account Approved',
    description: 'When an IB application is approved (matches email_template.txt)',
    category: 'ib',
    variables: ['firstName', 'partnerId', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;"><strong style="color:#e5e7eb;">Congratulations!</strong></p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Your Introducing Broker account has been approved.</p>
      <p style="color: #e5e7eb; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 20px 0 10px 0;">Partner ID</p>
      <p style="color: #f3f4f6; font-size: 16px; font-weight: 600; margin: 0 0 24px 0;">{{partnerId}}</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">BULL4X, Partner Program</p>
    `)
  },
  {
    name: 'Copy Trading Subscription Activated',
    slug: 'copy_trading_activated',
    subject: 'Copy Trading Activated',
    description: 'When copy trading subscription is active (matches email_template.txt)',
    category: 'notification',
    variables: ['firstName', 'masterTrader', 'accountId', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear {{firstName}},</p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Your copy trading subscription has been activated.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Master trader</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right; font-weight: 600;">{{masterTrader}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Account ID</td>
          <td style="padding: 8px 0; color: #f3f4f6; font-size: 14px; text-align: right;">{{accountId}}</td>
        </tr>
      </table>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your account will automatically copy trades from the selected strategy.
      </p>
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 28px 0 4px 0;">BULL4X, Compliance Team</p>
    `)
  },
  {
    name: 'Contact Inquiry',
    slug: 'contact_inquiry',
    subject: 'New Contact Inquiry from {{name}}',
    description: 'Sent to support when someone submits the contact form',
    category: 'support',
    variables: ['name', 'email', 'phone', 'message', 'date', 'year'],
    htmlContent: wrapEmailContent(`
      <p style="color: #aaa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">New Contact Form Submission</p>
      
      <div style="background-color: #1a1a2e; border-radius: 8px; padding: 20px; margin: 25px 0; border: 1px solid #333;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #333; color: #888; width: 120px;">Name</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #333; color: #fff; font-weight: bold;">{{name}}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #333; color: #888;">Email</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #333; color: #3b82f6;"><a href="mailto:{{email}}" style="color: #3b82f6; text-decoration: none;">{{email}}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #333; color: #888;">Phone</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #333; color: #fff;">{{phone}}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #888;">Submitted At</td>
            <td style="padding: 12px 0; color: #aaa;">{{date}}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #0f0f23; border-left: 4px solid #3b82f6; padding: 15px 20px; margin: 25px 0;">
        <p style="color: #888; font-size: 12px; margin: 0 0 10px 0;">MESSAGE:</p>
        <p style="color: #fff; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">{{message}}</p>
      </div>
      
      <p style="color: #888; font-size: 13px; margin: 20px 0 0 0;">Please respond to this inquiry at your earliest convenience.</p>
    `)
  }
]

// GET /api/email-templates - Get all templates
router.get('/', async (req, res) => {
  try {
    const templates = await EmailTemplate.find().sort({ category: 1, name: 1 })
    res.json({ success: true, templates })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/email-templates/:id - Get single template
router.get('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' })
    }
    res.json({ success: true, template })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/email-templates/:id - Update template
router.put('/:id', async (req, res) => {
  try {
    const { subject, htmlContent, isEnabled } = req.body
    const template = await EmailTemplate.findByIdAndUpdate(
      req.params.id,
      { subject, htmlContent, isEnabled },
      { new: true }
    )
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' })
    }
    res.json({ success: true, template, message: 'Template updated successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/email-templates/:id/toggle - Toggle template enabled status
router.put('/:id/toggle', async (req, res) => {
  try {
    const template = await EmailTemplate.findById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' })
    }
    template.isEnabled = !template.isEnabled
    await template.save()
    res.json({ success: true, template, message: `Template ${template.isEnabled ? 'enabled' : 'disabled'}` })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/email-templates/seed - Seed default templates
router.post('/seed', async (req, res) => {
  try {
    for (const template of defaultTemplates) {
      await EmailTemplate.findOneAndUpdate(
        { slug: template.slug },
        template,
        { upsert: true, new: true }
      )
    }
    res.json({ success: true, message: 'Default templates seeded successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/email-templates/settings/smtp - Get email settings
router.get('/settings/smtp', async (req, res) => {
  try {
    let settings = await EmailSettings.findOne()
    if (!settings) {
      settings = await EmailSettings.create({})
    }
    // Don't send password in response
    const safeSettings = {
      ...settings.toObject(),
      smtpPass: settings.smtpPass ? '********' : ''
    }
    res.json({ success: true, settings: safeSettings })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/email-templates/settings/smtp - Update email settings
router.put('/settings/smtp', async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, fromEmail, fromName, otpVerificationEnabled, otpExpiryMinutes } = req.body
    
    let settings = await EmailSettings.findOne()
    if (!settings) {
      settings = new EmailSettings()
    }
    
    settings.smtpHost = smtpHost
    settings.smtpPort = smtpPort
    settings.smtpUser = smtpUser
    if (smtpPass && smtpPass !== '********') {
      settings.smtpPass = smtpPass
    }
    settings.smtpSecure = smtpSecure
    settings.fromEmail = fromEmail
    settings.fromName = fromName
    if (otpVerificationEnabled !== undefined) {
      settings.otpVerificationEnabled = otpVerificationEnabled
    }
    if (otpExpiryMinutes !== undefined) {
      settings.otpExpiryMinutes = otpExpiryMinutes
    }
    
    await settings.save()
    res.json({ success: true, message: 'Email settings updated successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/email-templates/settings/toggle-smtp - Toggle SMTP on/off
router.put('/settings/toggle-smtp', async (req, res) => {
  try {
    let settings = await EmailSettings.findOne()
    if (!settings) {
      settings = new EmailSettings()
    }
    settings.smtpEnabled = !settings.smtpEnabled
    await settings.save()
    res.json({ 
      success: true, 
      smtpEnabled: settings.smtpEnabled,
      message: settings.smtpEnabled ? 'SMTP enabled' : 'SMTP disabled'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/email-templates/settings/test - Test SMTP connection
router.post('/settings/test', async (req, res) => {
  try {
    const result = await testSMTPConnection()
    res.json(result)
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/email-templates/settings/send-test - Send a test email
router.post('/settings/send-test', async (req, res) => {
  try {
    const { toEmail } = req.body
    if (!toEmail) {
      return res.status(400).json({ success: false, message: 'Email address is required' })
    }

    const settings = await EmailSettings.findOne()
    if (!settings || !settings.smtpHost) {
      return res.status(400).json({ success: false, message: 'SMTP settings not configured' })
    }

    const nodemailer = await import('nodemailer')
    
    // Port 465 = SSL, Port 587 = STARTTLS (secure should be false)
    const useSecure = settings.smtpPort === 465 ? true : settings.smtpSecure
    
    const transporter = nodemailer.default.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: useSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass
      },
      tls: {
        rejectUnauthorized: false
      }
    })

    const mailOptions = {
      from: '"' + settings.fromName + '" <' + settings.fromEmail + '>',
      to: toEmail,
      subject: 'Test Email - SMTP Configuration Working!',
      html: '<!DOCTYPE html><html><body style="margin: 0; padding: 40px; background-color: #0a0a0a; font-family: Arial, sans-serif;"><div style="max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #333;"><h1 style="color: #22c55e; margin: 0 0 20px; text-align: center;">✓ Test Successful!</h1><p style="color: #aaa; margin: 0 0 20px; line-height: 1.6; text-align: center;">Your SMTP configuration is working correctly.</p><div style="background: #0f0f23; border-radius: 8px; padding: 15px; margin-bottom: 20px;"><p style="color: #888; margin: 0 0 5px; font-size: 12px;">SMTP Host</p><p style="color: #fff; margin: 0;">' + settings.smtpHost + ':' + settings.smtpPort + '</p></div><p style="color: #666; font-size: 12px; margin: 0; text-align: center;">Sent at ' + new Date().toLocaleString() + '</p></div></body></html>'
    }

    await transporter.sendMail(mailOptions)
    res.json({ success: true, message: 'Test email sent to ' + toEmail })
  } catch (error) {
    console.error('Send test email error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/email-templates/:id/test - Send a test email using specific template
router.post('/:id/test', async (req, res) => {
  try {
    const { toEmail } = req.body
    if (!toEmail) {
      return res.status(400).json({ success: false, message: 'Email address is required' })
    }

    const template = await EmailTemplate.findById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' })
    }

    const settings = await EmailSettings.findOne()
    if (!settings || !settings.smtpHost) {
      return res.status(400).json({ success: false, message: 'SMTP settings not configured' })
    }

    const nodemailer = await import('nodemailer')
    const useSecure = settings.smtpPort === 465
    
    const transporter = nodemailer.default.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: useSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass
      },
      tls: { rejectUnauthorized: false }
    })

    // Generate sample data for template variables
    const sampleData = {
      firstName: 'John',
      email: toEmail,
      otp: '123456',
      expiryMinutes: '10',
      amount: '500.00',
      transactionId: 'TXN' + Date.now(),
      paymentMethod: 'Bank Transfer',
      date: new Date().toLocaleDateString(),
      newBalance: '1,500.00',
      platformName: settings.fromName || 'Trading Platform',
      supportEmail: settings.fromEmail || 'support@example.com',
      loginUrl: 'http://localhost:5173/login',
      reason: 'Violation of terms of service',
      year: new Date().getFullYear().toString()
    }

    // Replace variables in template
    let subject = template.subject
    let html = template.htmlContent
    for (const [key, value] of Object.entries(sampleData)) {
      const regex = new RegExp('{{' + key + '}}', 'g')
      subject = subject.replace(regex, value)
      html = html.replace(regex, value)
    }

    const mailOptions = {
      from: '"' + settings.fromName + '" <' + settings.fromEmail + '>',
      to: toEmail,
      subject: '[TEST] ' + subject,
      html: html
    }

    await transporter.sendMail(mailOptions)
    res.json({ success: true, message: 'Test email sent to ' + toEmail })
  } catch (error) {
    console.error('Send template test email error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// DELETE /api/email-templates/:id - Delete a template
router.delete('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findByIdAndDelete(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' })
    }
    res.json({ success: true, message: 'Template deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/email-templates/reset - Reset all templates (delete all and reseed)
router.post('/reset', async (req, res) => {
  try {
    await EmailTemplate.deleteMany({})
    for (const template of defaultTemplates) {
      await EmailTemplate.create(template)
    }
    res.json({ success: true, message: 'All templates reset to defaults' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/email-templates/sync - Sync templates (add missing, update existing)
router.post('/sync', async (req, res) => {
  try {
    let added = 0
    let updated = 0
    for (const template of defaultTemplates) {
      const existing = await EmailTemplate.findOne({ slug: template.slug })
      if (existing) {
        // Force update existing template with new content
        await EmailTemplate.findOneAndUpdate(
          { slug: template.slug },
          template,
          { new: true }
        )
        updated++
      } else {
        await EmailTemplate.create(template)
        added++
      }
    }
    res.json({ success: true, message: `Sync complete: ${added} added, ${updated} updated` })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Function to seed/update email templates (called on server startup)
export const seedEmailTemplates = async () => {
  try {
    for (const template of defaultTemplates) {
      await EmailTemplate.findOneAndUpdate(
        { slug: template.slug },
        template,
        { upsert: true, new: true }
      )
    }
    console.log('[EMAIL] Email templates synced successfully')
  } catch (error) {
    console.error('[EMAIL] Error seeding email templates:', error)
  }
}

export default router



