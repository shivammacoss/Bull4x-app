import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()

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
  status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'PENDING'], default: 'ACTIVE' },
  sidebarPermissions: { type: Object, default: {} },
  lastLogin: { type: Date }
}, { timestamps: true })

const Admin = mongoose.model('Admin', adminSchema)

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')

    const email = 'bull4x@support.com'
    const password = 'bull4x@8954'
    
    // Check if admin exists
    const existing = await Admin.findOne({ email })
    if (existing) {
      console.log('Admin already exists, updating password...')
      existing.password = await bcrypt.hash(password, 10)
      existing.role = 'SUPER_ADMIN'
      existing.status = 'ACTIVE'
      await existing.save()
      console.log('Admin password updated!')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const admin = new Admin({
        email,
        password: hashedPassword,
        firstName: 'BULL4X',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        urlSlug: 'bull4x-main',
        brandName: 'BULL4X',
        status: 'ACTIVE',
        sidebarPermissions: {}
      })
      await admin.save()
      console.log('Admin created successfully!')
    }

    console.log('Email:', email)
    console.log('Password:', password)
    
    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

createAdmin()
