import mongoose from 'mongoose'

const copySettingsSchema = new mongoose.Schema({
  // Global copy trading settings (single document)
  settingsType: {
    type: String,
    default: 'GLOBAL',
    unique: true
  },
  // Master requirements
  masterRequirements: {
    minEquity: { type: Number, default: 1000 },
    minTradingDays: { type: Number, default: 30 },
    minTotalTrades: { type: Number, default: 50 },
    minWinRate: { type: Number, default: 50 },
    kycRequired: { type: Boolean, default: true }
  },
  // Commission settings
  commissionSettings: {
    maxCommissionPercentage: { type: Number, default: 50 },
    minCommissionPercentage: { type: Number, default: 0 },
    defaultAdminSharePercentage: { type: Number, default: 30 },
    minPayoutAmount: { type: Number, default: 50 }
  },
  // Copy limits
  copyLimits: {
    maxFollowersPerMaster: { type: Number, default: 1000 },
    maxMastersPerFollower: { type: Number, default: 10 },
    minCopyLotSize: { type: Number, default: 0.01 },
    maxCopyLotSize: { type: Number, default: 100 }
  },
  // Admin pool
  adminCopyPool: {
    type: Number,
    default: 0
  },
  // Feature toggles
  isEnabled: {
    type: Boolean,
    default: true
  },
  allowNewMasterApplications: {
    type: Boolean,
    default: true
  },
  allowNewFollowers: {
    type: Boolean,
    default: true
  }
}, { timestamps: true })

// Static method to get settings
copySettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ settingsType: 'GLOBAL' })
  if (!settings) {
    settings = await this.create({ settingsType: 'GLOBAL' })
  } else {
    // Migrate old commission settings to new range (0-50%)
    if (settings.commissionSettings.minCommissionPercentage === 5 && 
        settings.commissionSettings.maxCommissionPercentage === 30) {
      settings.commissionSettings.minCommissionPercentage = 0
      settings.commissionSettings.maxCommissionPercentage = 50
      await settings.save()
    }
  }
  return settings
}

export default mongoose.model('CopySettings', copySettingsSchema)
