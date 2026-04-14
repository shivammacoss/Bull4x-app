import User from '../models/User.js'
import IBPlan from '../models/IBPlanNew.js'
import IBCommission from '../models/IBCommissionNew.js'
import IBWallet from '../models/IBWallet.js'
import IBLevel from '../models/IBLevel.js'
import IBCommissionConfig from '../models/IBCommissionConfig.js'
import IBApplication from '../models/IBApplication.js'
import IBPlatformRevenue from '../models/IBPlatformRevenue.js'
import TradingAccount from '../models/TradingAccount.js'
import AccountType from '../models/AccountType.js'
import { ibEvents } from './ibEvents.js'

class IBEngine {
  constructor() {
    this.CONTRACT_SIZES = {
      'XAUUSD': 100,
      'XAGUSD': 5000,
      'BTCUSD': 1,
      'ETHUSD': 1,
      'DEFAULT_FOREX': 100000,
      'DEFAULT_CRYPTO': 1
    }
  }

  getContractSize(symbol) {
    if (this.CONTRACT_SIZES[symbol]) return this.CONTRACT_SIZES[symbol]
    if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USD')) {
      if (symbol.length <= 6) return this.CONTRACT_SIZES.DEFAULT_CRYPTO
    }
    return this.CONTRACT_SIZES.DEFAULT_FOREX
  }

  /**
   * Broker gross commission pool for the trade (spread $ + ticket commission + per-lot from account type).
   * IB percentages apply to this gross; remainder is platform (admin) share.
   */
  calculateGrossCommission(trade, accountType) {
    const cs = trade.contractSize || this.getContractSize(trade.symbol)
    const spreadCash = (trade.spread || 0) * trade.quantity * cs
    const fromTicket =
      (trade.commission || 0) + (trade.closeCommission || 0) + spreadCash
    const fromAccountPerLot =
      accountType && accountType.commission ? accountType.commission * trade.quantity : 0
    let gross = Math.max(fromTicket, fromAccountPerLot)
    if (accountType?.spreadMarkup) {
      gross += accountType.spreadMarkup * trade.quantity * cs
    }
    return Math.round(Math.max(0, gross) * 100) / 100
  }

  async resolveAccountTypeForTrade(trade) {
    if (!trade.tradingAccountId || trade.accountType !== 'TradingAccount') {
      const fallback = await AccountType.findOne({ isActive: true, isDemo: false }).sort({ createdAt: 1 })
      return { accountType: fallback, accountTypeId: fallback?._id || null }
    }
    const ta = await TradingAccount.findById(trade.tradingAccountId).populate('accountTypeId')
    if (!ta?.accountTypeId) {
      const fallback = await AccountType.findOne({ isActive: true }).sort({ createdAt: 1 })
      return { accountType: fallback, accountTypeId: fallback?._id || null }
    }
    return { accountType: ta.accountTypeId, accountTypeId: ta.accountTypeId._id || ta.accountTypeId }
  }

  async recordPlatformRevenue(trade, accountTypeId, grossCommission, adminCut, totalDistributedToIBs) {
    try {
      await IBPlatformRevenue.findOneAndUpdate(
        { tradeId: trade._id },
        {
          $set: {
            traderUserId: trade.userId,
            accountTypeId,
            grossCommission,
            adminCut,
            totalDistributedToIBs
          }
        },
        { upsert: true }
      )
    } catch (e) {
      if (e.code !== 11000) console.error('[IB] recordPlatformRevenue', e)
    }
  }

  /** Seed default multi-level % per account type if none exist (new trades only; does not touch history). */
  async ensureDefaultCommissionConfigs() {
    const types = await AccountType.find({})
    const defaults = [30, 22, 15, 8, 5]
    for (const at of types) {
      const count = await IBCommissionConfig.countDocuments({ accountTypeId: at._id })
      if (count > 0) continue
      for (let i = 0; i < defaults.length; i++) {
        await IBCommissionConfig.create({
          accountTypeId: at._id,
          level: i + 1,
          commissionPercent: defaults[i],
          isActive: true
        })
      }
    }
  }

  /**
   * Validate: sum < 100, each > 0, each <= previous active level.
   * `levels`: [{ level, commissionPercent, isActive }]
   */
  validateCommissionLevels(levels) {
    const sorted = [...levels].filter(l => l.isActive !== false).sort((a, b) => a.level - b.level)
    if (sorted.length === 0) return { ok: false, message: 'At least one active level is required' }
    let prev = Infinity
    let sum = 0
    for (const row of sorted) {
      const p = Number(row.commissionPercent)
      if (!(p > 0)) return { ok: false, message: `Level ${row.level} must be > 0` }
      if (p > prev) return { ok: false, message: `Level ${row.level} must be ≤ previous level (${prev}%)` }
      prev = p
      sum += p
    }
    if (sum >= 100) return { ok: false, message: `Total ${sum}% must be < 100% (platform keeps the rest)` }
    return { ok: true, sum }
  }

  async getCommissionConfigsGrouped() {
    const types = await AccountType.find({}).sort({ name: 1 })
    const configs = await IBCommissionConfig.find({}).sort({ level: 1 })
    const byType = {}
    for (const c of configs) {
      const id = c.accountTypeId.toString()
      if (!byType[id]) byType[id] = []
      byType[id].push({
        level: c.level,
        commissionPercent: c.commissionPercent,
        isActive: c.isActive
      })
    }
    return types.map((t) => ({
      accountType: { _id: t._id, name: t.name, slug: t.slug },
      levels: byType[t._id.toString()] || []
    }))
  }

  async replaceCommissionConfigForAccountType(accountTypeId, levels) {
    const v = this.validateCommissionLevels(levels)
    if (!v.ok) throw new Error(v.message)
    const at = await AccountType.findById(accountTypeId)
    if (!at) throw new Error('Account type not found')
    await IBCommissionConfig.deleteMany({ accountTypeId })
    for (const row of levels) {
      await IBCommissionConfig.create({
        accountTypeId,
        level: Number(row.level),
        commissionPercent: Number(row.commissionPercent),
        isActive: row.isActive !== false
      })
    }
    return { accountTypeId, totalPercent: v.sum }
  }

  async rejectIBApplication(userId, reason = '', adminId = null) {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')
    const application = await IBApplication.findOne({ userId, status: 'PENDING' })
    if (application) {
      application.status = 'REJECTED'
      application.rejectionReason = reason || null
      application.reviewedAt = new Date()
      if (adminId) application.reviewedBy = adminId
      await application.save()
    }
    user.ibStatus = 'REJECTED'
    user.isIB = false
    user.referralCode = null
    user.ibRejectionReason = reason || null
    await user.save()
    return user
  }

  // Generate unique referral code
  async generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code
    let exists = true
    
    while (exists) {
      code = 'IB'
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      exists = await User.findOne({ referralCode: code })
    }
    
    return code
  }

  // Apply to become IB (queued in IBApplication; referral code issued on approval only)
  async applyForIB(userId, payoutMethod = '') {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')

    if (user.ibStatus === 'ACTIVE') {
      throw new Error('User is already an IB')
    }
    if (user.ibStatus === 'PENDING') {
      throw new Error('You already have a pending IB application')
    }
    const pendingApp = await IBApplication.findOne({ userId, status: 'PENDING' })
    if (pendingApp) {
      throw new Error('You already have a pending IB application')
    }

    let referredByIbUserId = null
    if (user.referredBy) {
      const parentIB = await User.findOne({
        referralCode: user.referredBy,
        isIB: true,
        ibStatus: 'ACTIVE'
      })
      if (parentIB) referredByIbUserId = parentIB._id
    }
    if (!referredByIbUserId && user.parentIBId) {
      const p = await User.findById(user.parentIBId)
      if (p?.isIB && p.ibStatus === 'ACTIVE') referredByIbUserId = p._id
    }

    await IBApplication.create({
      userId,
      referredByIbUserId,
      status: 'PENDING',
      payoutMethod: payoutMethod || ''
    })

    user.isIB = true
    user.ibStatus = 'PENDING'
    user.referralCode = null
    await user.save()

    return user
  }

  // Admin approve IB — creates chain link from application; issues referral code
  async approveIB(userId, planId = null, adminId = null, ibLevelId = null) {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')
    if (user.ibStatus === 'ACTIVE') {
      throw new Error('User is already an active IB')
    }
    if (user.ibStatus !== 'PENDING') {
      throw new Error('User is not a pending IB applicant')
    }

    const application = await IBApplication.findOne({ userId, status: 'PENDING' })
    if (application) {
      application.status = 'APPROVED'
      application.reviewedAt = new Date()
      if (adminId) application.reviewedBy = adminId
      await application.save()

      if (application.referredByIbUserId) {
        user.parentIBId = application.referredByIbUserId
        const parent = await User.findById(application.referredByIbUserId)
        user.ibLevel = parent ? (parent.ibLevel || 1) + 1 : 1
      } else {
        user.parentIBId = user.parentIBId || null
        if (!user.parentIBId) user.ibLevel = 1
        else {
          const parent = await User.findById(user.parentIBId)
          user.ibLevel = parent ? (parent.ibLevel || 1) + 1 : 1
        }
      }
    } else {
      // Legacy applicant (no IBApplication row): keep referredBy / parentIBId logic
      if (user.referredBy && !user.parentIBId) {
        const parentIB = await User.findOne({
          referralCode: user.referredBy,
          isIB: true,
          ibStatus: 'ACTIVE'
        })
        if (parentIB) {
          user.parentIBId = parentIB._id
          user.ibLevel = (parentIB.ibLevel || 1) + 1
        }
      }
      if (!user.ibLevel) user.ibLevel = user.parentIBId ? 2 : 1
    }

    user.isIB = true
    user.ibStatus = 'ACTIVE'
    user.referralCode = user.referralCode || (await this.generateReferralCode())
    user.ibRejectionReason = null

    if (planId) {
      user.ibPlanId = planId
    } else if (!user.ibPlanId) {
      const defaultPlan = await IBPlan.getDefaultPlan()
      if (defaultPlan) user.ibPlanId = defaultPlan._id
    }

    await user.save()
    await IBWallet.getOrCreateWallet(userId)
    await this.assignInitialLevel(userId, ibLevelId)

    return user
  }

  // Admin block IB
  async blockIB(userId, reason = '') {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')

    user.ibStatus = 'BLOCKED'
    await user.save()
    return user
  }

  // Register user with referral code
  async registerWithReferral(userId, referralCode) {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')

    const referringIB = await User.findOne({ 
      referralCode, 
      isIB: true, 
      ibStatus: 'ACTIVE' 
    })
    
    if (!referringIB) {
      throw new Error('Invalid or inactive referral code')
    }

    user.referredBy = referralCode
    user.parentIBId = referringIB._id
    await user.save()

    return { user, referringIB }
  }

  // Get IB chain for a trader (upline IBs)
  async getIBChain(userId, maxLevels = 5) {
    const chain = []
    let currentUser = await User.findById(userId)
    
    if (!currentUser) return chain

    let parentId = currentUser.parentIBId
    let level = 1

    while (parentId && level <= maxLevels) {
      const parentIB = await User.findById(parentId)
        .populate('ibPlanId')
      
      if (!parentIB || !parentIB.isIB || parentIB.ibStatus !== 'ACTIVE') {
        break
      }

      chain.push({
        ibUser: parentIB,
        level
      })

      parentId = parentIB.parentIBId
      level++
    }

    return chain
  }

  // Multi-level cascade: % of gross commission per account type & chain level (trader-relative L1 = direct IB)
  async processTradeCommission(trade) {
    const { accountType, accountTypeId } = await this.resolveAccountTypeForTrade(trade)
    const grossCommission = this.calculateGrossCommission(trade, accountType)

    if (grossCommission <= 0) {
      return { processed: false, reason: 'No gross commission' }
    }

    const ibChain = await this.getIBChain(trade.userId, 20)

    if (ibChain.length === 0) {
      await this.recordPlatformRevenue(trade, accountTypeId, grossCommission, grossCommission, 0)
      return { processed: false, reason: 'No IB chain found for trader' }
    }

    if (!accountTypeId) {
      await this.recordPlatformRevenue(trade, null, grossCommission, grossCommission, 0)
      return { processed: false, reason: 'No account type for commission config' }
    }

    const commissionResults = []
    const contractSize = trade.contractSize || this.getContractSize(trade.symbol)
    let totalDistributed = 0

    for (const { ibUser, level: chainLevel } of ibChain) {
      try {
        const config = await IBCommissionConfig.findOne({
          accountTypeId,
          level: chainLevel,
          isActive: true
        })
        if (!config) break

        const ibCut =
          Math.round(grossCommission * (config.commissionPercent / 100) * 100) / 100
        if (ibCut <= 0) continue

        totalDistributed += ibCut

        const existingCommission = await IBCommission.findOne({
          tradeId: trade._id,
          ibUserId: ibUser._id,
          level: chainLevel
        })
        if (existingCommission) continue

        await IBCommission.create({
          tradeId: trade._id,
          traderUserId: trade.userId,
          ibUserId: ibUser._id,
          level: chainLevel,
          baseAmount: trade.quantity,
          commissionAmount: ibCut,
          symbol: trade.symbol,
          tradeLotSize: trade.quantity,
          contractSize,
          commissionType: 'PERCENT_OF_GROSS',
          accountTypeId,
          grossCommission,
          commissionPercent: config.commissionPercent,
          status: 'CREDITED'
        })

        const wallet = await IBWallet.getOrCreateWallet(ibUser._id)
        await wallet.creditCommission(ibCut)

        commissionResults.push({
          ibUserId: ibUser._id,
          ibName: ibUser.firstName,
          level: chainLevel,
          commissionAmount: ibCut,
          commissionPercent: config.commissionPercent
        })
      } catch (error) {
        console.error(`[IB] commission upline level:`, error)
      }
    }

    const adminCut = Math.max(0, Math.round((grossCommission - totalDistributed) * 100) / 100)
    await this.recordPlatformRevenue(trade, accountTypeId, grossCommission, adminCut, totalDistributed)

    if (commissionResults.length > 0) {
      ibEvents.emit('IB_COMMISSION_DISTRIBUTED', {
        tradeId: trade._id,
        traderUserId: trade.userId,
        grossCommission,
        totalDistributedToIBs: totalDistributed,
        platformCut: adminCut,
        entries: commissionResults
      })
    }

    return {
      processed: true,
      grossCommission,
      totalDistributedToIBs: totalDistributed,
      platformCut: adminCut,
      commissionsGenerated: commissionResults.length,
      results: commissionResults
    }
  }

  // Reverse commission (admin action)
  async reverseCommission(commissionId, adminId, reason = '') {
    const commission = await IBCommission.findById(commissionId)
    if (!commission) throw new Error('Commission not found')
    if (commission.status === 'REVERSED') throw new Error('Commission already reversed')

    // Deduct from IB wallet
    const wallet = await IBWallet.getOrCreateWallet(commission.ibUserId)
    await wallet.reverseCommission(commission.commissionAmount)

    // Update commission status
    commission.status = 'REVERSED'
    commission.reversedAt = new Date()
    commission.reversedBy = adminId
    commission.reversalReason = reason
    await commission.save()

    return commission
  }

  // Get IB tree using $graphLookup (for admin visualization)
  async getIBTree(ibId, maxDepth = 5) {
    const result = await User.aggregate([
      { $match: { _id: ibId } },
      {
        $graphLookup: {
          from: 'users',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parentIBId',
          as: 'downlines',
          maxDepth: maxDepth - 1,
          depthField: 'level'
        }
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          email: 1,
          referralCode: 1,
          ibStatus: 1,
          ibLevel: 1,
          downlines: {
            _id: 1,
            firstName: 1,
            email: 1,
            referralCode: 1,
            ibStatus: 1,
            isIB: 1,
            parentIBId: 1,
            referredBy: 1,
            level: 1
          }
        }
      }
    ])

    return result[0] || null
  }

  // Get IB stats for admin dashboard
  async getIBStats(ibUserId) {
    const user = await User.findById(ibUserId)
    if (!user || !user.isIB) throw new Error('IB not found')

    // Get wallet
    const wallet = await IBWallet.getOrCreateWallet(ibUserId)

    // Get direct referrals count
    const directReferrals = await User.countDocuments({ parentIBId: ibUserId })

    // Get total downline count (all levels)
    const tree = await this.getIBTree(user._id, 5)
    const totalDownline = tree?.downlines?.length || 0

    // Get commission stats
    const commissionStats = await IBCommission.aggregate([
      { $match: { ibUserId: user._id, status: 'CREDITED' } },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$commissionAmount' },
          totalTrades: { $sum: 1 }
        }
      }
    ])

    // Get active traders (users who traded in last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const activeTraders = await IBCommission.aggregate([
      { 
        $match: { 
          ibUserId: user._id, 
          createdAt: { $gte: thirtyDaysAgo } 
        } 
      },
      { $group: { _id: '$traderUserId' } },
      { $count: 'count' }
    ])

    // Get commission counts per level
    const levelCommissions = await IBCommission.aggregate([
      { $match: { ibUserId: user._id, status: 'CREDITED' } },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 },
          totalAmount: { $sum: '$commissionAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ])

    // Build level counts object
    const levelCounts = {}
    for (let i = 1; i <= 5; i++) {
      const levelData = levelCommissions.find(l => l._id === i)
      levelCounts[`level${i}Count`] = levelData?.count || 0
      levelCounts[`level${i}Commission`] = levelData?.totalAmount || 0
    }

    return {
      ibUser: {
        _id: user._id,
        firstName: user.firstName,
        email: user.email,
        referralCode: user.referralCode,
        ibStatus: user.ibStatus,
        ibLevel: user.ibLevel
      },
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
        pendingWithdrawal: wallet.pendingWithdrawal
      },
      stats: {
        directReferrals,
        totalDownline,
        totalCommission: commissionStats[0]?.totalCommission || 0,
        totalTrades: commissionStats[0]?.totalTrades || 0,
        activeTraders: activeTraders[0]?.count || 0,
        ...levelCounts
      }
    }
  }

  // Withdraw from IB wallet to main wallet
  async withdrawToWallet(ibUserId, amount) {
    const user = await User.findById(ibUserId)
    if (!user || !user.isIB) throw new Error('IB not found')

    const wallet = await IBWallet.getOrCreateWallet(ibUserId)
    
    if (amount > wallet.balance) {
      throw new Error('Insufficient IB wallet balance')
    }

    // Deduct from IB wallet
    await wallet.requestWithdrawal(amount)
    
    // Add to user's main wallet balance
    user.walletBalance = (user.walletBalance || 0) + amount
    await user.save()

    // Complete the withdrawal
    await wallet.completeWithdrawal(amount)

    return {
      ibWalletBalance: wallet.balance,
      mainWalletBalance: user.walletBalance,
      withdrawnAmount: amount
    }
  }

  // Check and auto-upgrade IB level based on referral count
  async checkAndUpgradeLevel(ibUserId) {
    const user = await User.findById(ibUserId).populate('ibLevelId')
    if (!user || !user.isIB || user.ibStatus !== 'ACTIVE') return null
    if (!user.autoUpgradeEnabled) return null

    // Get direct referral count
    const referralCount = await User.countDocuments({ parentIBId: ibUserId })
    
    // Get all levels sorted by order
    const levels = await IBLevel.getAllLevels()
    if (levels.length === 0) return null

    // Find the highest level the user qualifies for
    let qualifiedLevel = levels[0] // Start with lowest level
    for (const level of levels) {
      if (referralCount >= level.referralTarget) {
        qualifiedLevel = level
      }
    }

    // Check if upgrade is needed
    const currentLevelOrder = user.ibLevelOrder || 1
    if (qualifiedLevel.order > currentLevelOrder) {
      user.ibLevelId = qualifiedLevel._id
      user.ibLevelOrder = qualifiedLevel.order
      await user.save()
      
      console.log(`[IB Level] User ${user.firstName} upgraded to ${qualifiedLevel.name} (${referralCount} referrals)`)
      return {
        upgraded: true,
        previousLevel: currentLevelOrder,
        newLevel: qualifiedLevel,
        referralCount
      }
    }

    return { upgraded: false, currentLevel: qualifiedLevel, referralCount }
  }

  // Get IB level progress for user dashboard
  async getIBLevelProgress(ibUserId) {
    const user = await User.findById(ibUserId).populate('ibLevelId')
    if (!user || !user.isIB) throw new Error('IB not found')

    // Get direct referral count
    const referralCount = await User.countDocuments({ parentIBId: ibUserId })
    
    // Get all levels
    const levels = await IBLevel.getAllLevels()
    if (levels.length === 0) {
      // Initialize default levels if none exist
      await IBLevel.initializeDefaultLevels()
      const newLevels = await IBLevel.getAllLevels()
      return this._calculateLevelProgress(user, referralCount, newLevels)
    }

    return this._calculateLevelProgress(user, referralCount, levels)
  }

  _calculateLevelProgress(user, referralCount, levels) {
    // Find current level
    let currentLevel = levels.find(l => l.order === (user.ibLevelOrder || 1)) || levels[0]
    
    // Find next level
    const nextLevel = levels.find(l => l.order === currentLevel.order + 1)
    
    // Calculate progress
    let progressPercent = 100
    let referralsNeeded = 0
    
    if (nextLevel) {
      const currentTarget = currentLevel.referralTarget
      const nextTarget = nextLevel.referralTarget
      const range = nextTarget - currentTarget
      const progress = referralCount - currentTarget
      progressPercent = Math.min(100, Math.max(0, (progress / range) * 100))
      referralsNeeded = Math.max(0, nextTarget - referralCount)
    }

    return {
      currentLevel: {
        _id: currentLevel._id,
        name: currentLevel.name,
        order: currentLevel.order,
        commissionRate: currentLevel.commissionRate,
        commissionType: currentLevel.commissionType,
        color: currentLevel.color,
        icon: currentLevel.icon,
        referralTarget: currentLevel.referralTarget,
        downlineCommission: currentLevel.downlineCommission
      },
      nextLevel: nextLevel ? {
        _id: nextLevel._id,
        name: nextLevel.name,
        order: nextLevel.order,
        commissionRate: nextLevel.commissionRate,
        referralTarget: nextLevel.referralTarget,
        color: nextLevel.color
      } : null,
      referralCount,
      referralsNeeded,
      progressPercent: Math.round(progressPercent),
      autoUpgradeEnabled: user.autoUpgradeEnabled,
      allLevels: levels.map(l => ({
        _id: l._id,
        name: l.name,
        order: l.order,
        commissionRate: l.commissionRate,
        commissionType: l.commissionType,
        referralTarget: l.referralTarget,
        color: l.color,
        icon: l.icon,
        isCurrentLevel: l.order === currentLevel.order,
        isUnlocked: referralCount >= l.referralTarget
      }))
    }
  }

  // Assign initial tier (IB Level document) to new IB — optional admin-picked level
  async assignInitialLevel(userId, preferredIbLevelId = null) {
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')

    if (preferredIbLevelId) {
      const picked = await IBLevel.findOne({ _id: preferredIbLevelId, isActive: true })
      if (picked) {
        user.ibLevelId = picked._id
        user.ibLevelOrder = picked.order
        await user.save()
        return user
      }
    }

    let firstLevel = await IBLevel.findOne({ order: 1, isActive: true })
    if (!firstLevel) {
      await IBLevel.initializeDefaultLevels()
      firstLevel = await IBLevel.findOne({ order: 1, isActive: true })
    }

    if (firstLevel) {
      user.ibLevelId = firstLevel._id
      user.ibLevelOrder = firstLevel.order
      await user.save()
    }

    return user
  }
}

export default new IBEngine()
