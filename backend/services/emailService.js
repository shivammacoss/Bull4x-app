import nodemailer from 'nodemailer'
import EmailSettings from '../models/EmailSettings.js'
import EmailTemplate from '../models/EmailTemplate.js'

let transporter = null

// Initialize or get transporter
const getTransporter = async () => {
  const settings = await EmailSettings.findOne()
  
  if (!settings || !settings.smtpHost || !settings.smtpUser) {
    return null
  }

  // Port 465 = direct SSL (secure: true)
  // Port 587 = STARTTLS (secure: false, upgrades to TLS)
  // Port 25 = plain (secure: false)
  const useSecure = settings.smtpPort === 465

  const transportConfig = {
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
  }

  transporter = nodemailer.createTransport(transportConfig)

  return transporter
}

// Replace template variables
const replaceVariables = (content, variables) => {
  let result = content
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, value || '')
  }
  return result
}

// Send email using template
export const sendTemplateEmail = async (templateSlug, toEmail, variables = {}) => {
  try {
    const settings = await EmailSettings.findOne()
    
    // Check if SMTP is enabled
    if (!settings || !settings.smtpEnabled) {
      console.log('SMTP is disabled, skipping email')
      return { success: false, message: 'SMTP is disabled' }
    }
    
    if (!settings.smtpHost) {
      console.log('Email settings not configured')
      return { success: false, message: 'Email settings not configured' }
    }

    const template = await EmailTemplate.findOne({ slug: templateSlug })
    if (!template) {
      console.log(`Template not found: ${templateSlug}`)
      return { success: false, message: 'Template not found' }
    }

    if (!template.isEnabled) {
      console.log(`Template disabled: ${templateSlug}`)
      return { success: false, message: 'Template is disabled' }
    }

    const transport = await getTransporter()
    if (!transport) {
      return { success: false, message: 'Failed to create email transport' }
    }

    const subject = replaceVariables(template.subject, variables)
    const html = replaceVariables(template.htmlContent, variables)

    const mailOptions = {
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: toEmail,
      subject: subject,
      html: html
    }

    const info = await transport.sendMail(mailOptions)
    console.log('Email sent:', info.messageId)
    
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, message: error.message }
  }
}

// Generate OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Check if OTP verification is enabled (requires both SMTP and OTP to be enabled)
export const isOTPEnabled = async () => {
  const settings = await EmailSettings.findOne()
  // OTP is only enabled if both SMTP is enabled AND OTP verification is enabled
  if (!settings) return false
  return settings.smtpEnabled && settings.otpVerificationEnabled
}

// Get OTP expiry in minutes
export const getOTPExpiry = () => {
  return 10 // Default 10 minutes
}

// Test SMTP connection
export const testSMTPConnection = async () => {
  try {
    const settings = await EmailSettings.findOne()
    
    // Validate SMTP host is configured and looks like a hostname
    if (!settings || !settings.smtpHost) {
      return { success: false, message: 'SMTP Host is not configured. Please enter a valid SMTP server (e.g., smtp.gmail.com)' }
    }
    
    // Check if smtpHost looks like an email address instead of a hostname
    if (settings.smtpHost.includes('@')) {
      return { success: false, message: 'SMTP Host should be a server hostname (e.g., smtp.gmail.com), not an email address' }
    }
    
    if (!settings.smtpUser) {
      return { success: false, message: 'SMTP Username is not configured' }
    }
    
    if (!settings.smtpPass) {
      return { success: false, message: 'SMTP Password is not configured' }
    }
    
    const transport = await getTransporter()
    if (!transport) {
      return { success: false, message: 'Failed to create SMTP transport' }
    }
    
    await transport.verify()
    return { success: true, message: 'SMTP connection successful' }
  } catch (error) {
    // Provide more helpful error messages for common issues
    if (error.message.includes('EBADNAME') || error.message.includes('ENOTFOUND')) {
      return { success: false, message: 'Invalid SMTP Host. Please check the server hostname (e.g., smtp.gmail.com)' }
    }
    if (error.message.includes('EAUTH') || error.message.includes('authentication')) {
      return { success: false, message: 'Authentication failed. Please check your username and password' }
    }
    return { success: false, message: error.message }
  }
}

// Send OTP email using database template
export const sendOTPEmail = async (toEmail, otp, firstName = 'User') => {
  try {
    // Use the admin_login_otp template from database
    return await sendTemplateEmail('admin_login_otp', toEmail, {
      otp,
      firstName,
      email: toEmail,
      expiryMinutes: '10',
      year: new Date().getFullYear().toString()
    })
  } catch (error) {
    console.error('Error sending OTP email:', error)
    return { success: false, message: error.message }
  }
}

export default {
  sendTemplateEmail,
  sendOTPEmail,
  generateOTP,
  isOTPEnabled,
  getOTPExpiry,
  testSMTPConnection
}
