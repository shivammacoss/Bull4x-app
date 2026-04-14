import mongoose from 'mongoose'

const ibCommissionConfigSchema = new mongoose.Schema(
  {
    accountTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountType',
      required: true
    },
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 20
    },
    commissionPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
)

ibCommissionConfigSchema.index({ accountTypeId: 1, level: 1 }, { unique: true })

export default mongoose.model('IBCommissionConfig', ibCommissionConfigSchema)
