import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()

// Admin credentials to be used for initial setup
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@localhost'
const ADMIN_PASSWORD = 'Admin@123'
const ADMIN_FIRST_NAME = 'Super'
const ADMIN_LAST_NAME = 'Admin'
const ADMIN_URL_SLUG = 'bull4x'

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, default: '' },
  role: { type: String, enum: ['SUPER_ADMIN', 'ADMIN'], default: 'ADMIN' },
  urlSlug: { type: String, required: true, unique: true, lowercase: true },
  brandName: { type: String, default: '' },
  logo: { type: String, default: '' },
  parentAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  permissions: {
    canManageUsers: { type: Boolean, default: true },
    canCreateUsers: { type: Boolean, default: true },
    canDeleteUsers: { type: Boolean, default: true },
    canViewUsers: { type: Boolean, default: true },
    canManageTrades: { type: Boolean, default: true },
    canCloseTrades: { type: Boolean, default: true },
    canModifyTrades: { type: Boolean, default: true },
    canManageAccounts: { type: Boolean, default: true },
    canCreateAccounts: { type: Boolean, default: true },
    canDeleteAccounts: { type: Boolean, default: true },
    canModifyLeverage: { type: Boolean, default: true },
    canManageDeposits: { type: Boolean, default: true },
    canApproveDeposits: { type: Boolean, default: true },
    canManageWithdrawals: { type: Boolean, default: true },
    canApproveWithdrawals: { type: Boolean, default: true },
    canManageKYC: { type: Boolean, default: true },
    canApproveKYC: { type: Boolean, default: true },
    canManageIB: { type: Boolean, default: true },
    canApproveIB: { type: Boolean, default: true },
    canManageCopyTrading: { type: Boolean, default: true },
    canApproveMasters: { type: Boolean, default: true },
    canManageSymbols: { type: Boolean, default: true },
    canManageGroups: { type: Boolean, default: true },
    canManageSettings: { type: Boolean, default: true },
    canManageTheme: { type: Boolean, default: true },
    canViewReports: { type: Boolean, default: true },
    canExportReports: { type: Boolean, default: true },
    canManageAdmins: { type: Boolean, default: true },
    canFundAdmins: { type: Boolean, default: true }
  },
  status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'PENDING'], default: 'ACTIVE' },
  lastLogin: { type: Date, default: null }
}, { timestamps: true })

const Admin = mongoose.model('Admin', adminSchema)

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')

    const existingAdmin = await Admin.findOne({ $or: [{ email: ADMIN_EMAIL }, { urlSlug: ADMIN_URL_SLUG.toLowerCase() }] })
    if (existingAdmin) {
      // Update password to ensure it matches
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10)
      await Admin.updateOne({ _id: existingAdmin._id }, { password: hashedPassword })
      console.log('\n✅ Admin exists - Password reset!')
      console.log('Email:', existingAdmin.email)
      console.log('Password:', ADMIN_PASSWORD)
      console.log('URL Slug:', existingAdmin.urlSlug)
      console.log('Role:', existingAdmin.role)
      process.exit(0)
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10)

    await Admin.create({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      role: 'SUPER_ADMIN',
      urlSlug: ADMIN_URL_SLUG,
      brandName: 'BULL4X',
      status: 'ACTIVE'
    })

    console.log('\n✅ Admin created!')
    console.log('Email:', ADMIN_EMAIL)
    console.log('Password:', ADMIN_PASSWORD)
    process.exit(0)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

createAdmin()
