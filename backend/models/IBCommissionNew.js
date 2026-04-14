import mongoose from 'mongoose'

const ibCommissionSchema = new mongoose.Schema({
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
  ibUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  level: {
    type: Number,
    required: true
  },
  baseAmount: {
    type: Number,
    required: true,
    default: 0
  },
  commissionAmount: {
    type: Number,
    required: true,
    default: 0
  },
  symbol: {
    type: String,
    required: true
  },
  tradeLotSize: {
    type: Number,
    required: true
  },
  contractSize: {
    type: Number,
    default: 100000
  },
  accountTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountType',
    default: null
  },
  grossCommission: {
    type: Number,
    default: 0
  },
  commissionPercent: {
    type: Number,
    default: 0
  },
  commissionType: {
    type: String,
    enum: ['PER_LOT', 'PERCENT', 'PERCENT_OF_GROSS'],
    required: true,
    default: 'PERCENT_OF_GROSS'
  },
  status: {
    type: String,
    enum: ['PENDING', 'CREDITED', 'PAID_OUT', 'REVERSED'],
    default: 'CREDITED'
  },
  reversedAt: {
    type: Date,
    default: null
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reversalReason: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

/** Trader-relative upline step (same as level); API alias for spec "chain_level". */
ibCommissionSchema.virtual('chainLevel').get(function () {
  return this.level
})

export default mongoose.model('IBCommission', ibCommissionSchema)
