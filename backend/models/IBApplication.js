import mongoose from 'mongoose'

const ibApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    referredByIbUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    },
    payoutMethod: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
)

ibApplicationSchema.index({ userId: 1, status: 1 })

export default mongoose.model('IBApplication', ibApplicationSchema)
