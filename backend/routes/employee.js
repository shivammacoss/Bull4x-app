import express from 'express'
import jwt from 'jsonwebtoken'
import { getSupportEmailFallback } from '../config/siteUrls.js'
import Employee from '../models/Employee.js'
import OTP from '../models/OTP.js'
import { sendOTPEmail, generateOTP, getOTPExpiry } from '../services/emailService.js'
import EmailSettings from '../models/EmailSettings.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Middleware to verify employee token
const verifyEmployee = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    if (!decoded.employeeId) {
      return res.status(401).json({ success: false, message: 'Invalid token' })
    }

    const employee = await Employee.findById(decoded.employeeId)
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' })
    }

    if (employee.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is suspended or inactive' })
    }

    req.employee = employee
    next()
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

// Permission check middleware factory
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.employee.permissions[permission]) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to perform this action' 
      })
    }
    next()
  }
}

// POST /api/employee/send-login-otp - Send OTP for employee login (passwordless)
router.post('/send-login-otp', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' })
    }

    const employee = await Employee.findOne({ email: email.toLowerCase() })
    if (!employee) {
      return res.status(401).json({ success: false, message: 'Employee account not found' })
    }

    if (employee.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is suspended or inactive' })
    }

    // Generate and send OTP
    const otp = generateOTP()
    const expiryMinutes = await getOTPExpiry()
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email: email.toLowerCase(), purpose: 'employee_login' })

    // Save new OTP
    await OTP.create({
      email: email.toLowerCase(),
      otp,
      purpose: 'employee_login',
      expiresAt
    })

    // Get platform name from settings
    const settings = await EmailSettings.findOne()
    const platformName = settings?.fromName || 'BULL4X'
    const supportEmail = settings?.fromEmail || getSupportEmailFallback()

    // Send OTP email directly (no template needed)
    const emailResult = await sendOTPEmail(email, otp, employee.firstName || 'Employee')

    if (emailResult.success) {
      res.json({ success: true, message: 'OTP sent to your email' })
    } else {
      console.error('Failed to send employee login OTP:', emailResult.message)
      res.status(500).json({ success: false, message: `Failed to send OTP: ${emailResult.message}` })
    }
  } catch (error) {
    console.error('Employee send OTP error:', error)
    res.status(500).json({ success: false, message: 'Failed to send OTP', error: error.message })
  }
})

// POST /api/employee/verify-login-otp - Verify OTP and complete employee login
router.post('/verify-login-otp', async (req, res) => {
  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' })
    }

    const otpRecord = await OTP.findOne({ email: email.toLowerCase(), otp, purpose: 'employee_login' })
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' })
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return res.status(400).json({ success: false, message: 'OTP has expired' })
    }

    // Delete the OTP after successful verification
    await OTP.deleteOne({ _id: otpRecord._id })

    // Get employee and complete login
    const employee = await Employee.findOne({ email: email.toLowerCase() })
    if (!employee) {
      return res.status(401).json({ success: false, message: 'Employee not found' })
    }

    // Update last login
    employee.lastLogin = new Date()
    await employee.save()

    const token = jwt.sign(
      { employeeId: employee._id, role: employee.role, email: employee.email },
      JWT_SECRET,
      { expiresIn: '12h' }
    )

    const allowedRoutes = employee.getAllowedRoutes()

    res.json({
      success: true,
      token,
      employee: {
        _id: employee._id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role,
        permissions: employee.permissions,
        allowedRoutes
      }
    })
  } catch (error) {
    console.error('Employee verify OTP error:', error)
    res.status(500).json({ success: false, message: 'OTP verification failed', error: error.message })
  }
})

// POST /api/employee/login - Employee login (with OTP support)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const employee = await Employee.findOne({ email: email.toLowerCase() })
    if (!employee) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    if (employee.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is suspended or inactive' })
    }

    const isMatch = await employee.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    // Employee portal: always email + password (OTP routes remain for optional flows)
    // Update last login
    employee.lastLogin = new Date()
    await employee.save()

    const token = jwt.sign(
      { employeeId: employee._id, role: employee.role, email: employee.email },
      JWT_SECRET,
      { expiresIn: '12h' }
    )

    // Get allowed routes
    const allowedRoutes = employee.getAllowedRoutes()

    res.json({
      success: true,
      otpRequired: false,
      token,
      employee: {
        _id: employee._id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role,
        permissions: employee.permissions,
        allowedRoutes
      }
    })
  } catch (error) {
    console.error('Employee login error:', error)
    res.status(500).json({ success: false, message: 'Login failed', error: error.message })
  }
})

// GET /api/employee/me - Get current employee
router.get('/me', verifyEmployee, async (req, res) => {
  try {
    const allowedRoutes = req.employee.getAllowedRoutes()
    
    res.json({
      success: true,
      employee: {
        _id: req.employee._id,
        email: req.employee.email,
        firstName: req.employee.firstName,
        lastName: req.employee.lastName,
        role: req.employee.role,
        permissions: req.employee.permissions,
        allowedRoutes,
        lastLogin: req.employee.lastLogin
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/employee/change-password - Change own password
router.put('/change-password', verifyEmployee, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords are required' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' })
    }

    const isMatch = await req.employee.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' })
    }

    req.employee.password = newPassword
    req.employee.passwordChangedAt = new Date()
    await req.employee.save()

    res.json({ success: true, message: 'Password changed successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/employee/dashboard - Get dashboard stats
router.get('/dashboard', verifyEmployee, checkPermission('canViewDashboard'), async (req, res) => {
  try {
    const stats = {}
    res.json({ success: true, stats })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
