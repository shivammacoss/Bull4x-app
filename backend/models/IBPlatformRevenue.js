import mongoose from 'mongoose'

/** Remaining platform share after IB cascade (per closed trade). */
const ibPlatformRevenueSchema = new mongoose.Schema(
  {
    tradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trade',
      required: true
    },
    traderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    accountTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountType',
      default: null
    },
    grossCommission: {
      type: Number,
      required: true
    },
    adminCut: {
      type: Number,
      required: true
    },
    totalDistributedToIBs: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
)

ibPlatformRevenueSchema.index({ tradeId: 1 }, { unique: true })

export default mongoose.model('IBPlatformRevenue', ibPlatformRevenueSchema)
