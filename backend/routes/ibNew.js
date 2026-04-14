import express from 'express'
import User from '../models/User.js'
import IBPlan from '../models/IBPlanNew.js'
import IBCommission from '../models/IBCommissionNew.js'
import IBWallet from '../models/IBWallet.js'
import IBLevel from '../models/IBLevel.js'
import IBSettings from '../models/IBSettings.js'
import IBApplication from '../models/IBApplication.js'
import AccountType from '../models/AccountType.js'
import ibEngine from '../services/ibEngineNew.js'
import mongoose from 'mongoose'

const router = express.Router()

/** True if targetIBId is the user or anywhere in user's downline (would create a cycle as parent). */
async function wouldCreateReferralCycle(userId, targetIBId) {
  if (!userId || !targetIBId) return false
  if (String(userId) === String(targetIBId)) return true
  try {
    const tree = await ibEngine.getIBTree(new mongoose.Types.ObjectId(userId), 30)
    const down = tree?.downlines || []
    return down.some((d) => String(d._id) === String(targetIBId))
  } catch {
    return false
  }
}

function userIdFromQuery(req) {
  const q = req.query.userId
  if (q === undefined || q === null || q === '' || q === 'undefined' || q === 'null') return null
  return String(q).trim()
}

function buildReferralLink(code) {
  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
  if (process.env.IB_REFERRAL_USE_REF_PATH === 'false') {
    return `${baseUrl}/signup?ref=${code}`
  }
  return `${baseUrl}/ref/${code}`
}

// ==================== USER ROUTES ====================

// POST /api/ib/apply - Apply to become an IB
router.post('/apply', async (req, res) => {
  try {
    const { userId, payoutMethod } = req.body
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' })
    }

    const user = await ibEngine.applyForIB(userId, payoutMethod)
    res.json({
      success: true,
      message: 'IB application submitted successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        isIB: user.isIB,
        ibStatus: user.ibStatus,
        referralCode: user.referralCode,
        ibLevel: user.ibLevel
      }
    })
  } catch (error) {
    console.error('Error applying for IB:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// POST /api/ib/reapply - Re-apply after rejection
router.post('/reapply', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    if (user.ibStatus !== 'REJECTED') {
      return res.status(400).json({ success: false, message: 'Only rejected applications can re-apply' })
    }

    let referredByIbUserId = null
    if (user.referredBy) {
      const ref = await User.findOne({
        referralCode: user.referredBy,
        isIB: true,
        ibStatus: 'ACTIVE'
      })
      if (ref) referredByIbUserId = ref._id
    }
    if (!referredByIbUserId && user.parentIBId) {
      const p = await User.findById(user.parentIBId)
      if (p?.isIB && p.ibStatus === 'ACTIVE') referredByIbUserId = p._id
    }

    await IBApplication.create({
      userId,
      referredByIbUserId,
      status: 'PENDING',
      appliedAt: new Date()
    })

    user.ibStatus = 'PENDING'
    user.isIB = true
    user.referralCode = null
    user.ibRejectionReason = null
    await user.save()

    res.json({
      success: true,
      message: 'Re-application submitted successfully',
      ibUser: {
        _id: user._id,
        ibStatus: user.ibStatus,
        status: user.ibStatus
      }
    })
  } catch (error) {
    console.error('Error re-applying for IB:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// POST /api/ib/register-referral - Register with referral code
router.post('/register-referral', async (req, res) => {
  try {
    const { userId, referralCode } = req.body
    if (!userId || !referralCode) {
      return res.status(400).json({ success: false, message: 'User ID and referral code are required' })
    }

    const result = await ibEngine.registerWithReferral(userId, referralCode)
    res.json({
      success: true,
      message: 'Referral registered successfully',
      referredBy: result.referringIB.firstName
    })
  } catch (error) {
    console.error('Error registering referral:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// GET /api/ib/status?userId= — spec (query)
router.get('/status', async (req, res) => {
  try {
    const userId = userIdFromQuery(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query parameter is required' })
    }
    const user = await User.findById(userId).select('isIB ibStatus referralCode ibRejectionReason')
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    const application = await IBApplication.findOne({ userId })
      .sort({ createdAt: -1 })
      .populate('referredByIbUserId', 'firstName referralCode email')
    res.json({
      success: true,
      ibStatus: user.ibStatus,
      isIB: user.isIB,
      referralCode: user.referralCode,
      rejectionReason: user.ibRejectionReason,
      latestApplication: application
    })
  } catch (error) {
    console.error('Error fetching IB status:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/status/:userId — application / IB status (spec)
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const user = await User.findById(userId).select('isIB ibStatus referralCode ibRejectionReason')
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    const application = await IBApplication.findOne({ userId })
      .sort({ createdAt: -1 })
      .populate('referredByIbUserId', 'firstName referralCode email')
    res.json({
      success: true,
      ibStatus: user.ibStatus,
      isIB: user.isIB,
      referralCode: user.referralCode,
      rejectionReason: user.ibRejectionReason,
      latestApplication: application
    })
  } catch (error) {
    console.error('Error fetching IB status:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/referral-link?userId= — spec
router.get('/referral-link', async (req, res) => {
  const userId = userIdFromQuery(req)
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId query parameter is required' })
  }
  try {
    const user = await User.findById(userId).select('referralCode ibStatus isIB')
    if (!user || !user.referralCode || user.ibStatus !== 'ACTIVE') {
      return res.status(404).json({
        success: false,
        message: 'Active IB with referral code not found'
      })
    }
    res.json({
      success: true,
      referralCode: user.referralCode,
      referralLink: buildReferralLink(user.referralCode)
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/referral-link/:userId — public referral URL (active IB only)
router.get('/referral-link/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const user = await User.findById(userId).select('referralCode ibStatus isIB')
    if (!user || !user.referralCode || user.ibStatus !== 'ACTIVE') {
      return res.status(404).json({
        success: false,
        message: 'Active IB with referral code not found'
      })
    }
    res.json({
      success: true,
      referralCode: user.referralCode,
      referralLink: buildReferralLink(user.referralCode)
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

async function sendIbDashboard(req, res, userId) {
  if (!userId || userId === 'undefined' || userId === 'null') {
    return res.status(400).json({ success: false, message: 'Invalid user ID' })
  }

  const user = await User.findById(userId).populate('ibPlanId').populate('ibLevelId')

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' })
  }

  if (!user.isIB) {
    return res.json({ success: true, isIB: false })
  }

  const wallet = await IBWallet.getOrCreateWallet(userId)
  const stats = await ibEngine.getIBStats(userId)

  let levelProgress = null
  try {
    levelProgress = await ibEngine.getIBLevelProgress(userId)
  } catch (e) {
    console.error('Error getting level progress:', e)
  }

  if (user.autoUpgradeEnabled) {
    await ibEngine.checkAndUpgradeLevel(userId)
  }

  res.json({
    success: true,
    isIB: true,
    ibUser: {
      _id: user._id,
      firstName: user.firstName,
      email: user.email,
      referralCode: user.referralCode,
      ibStatus: user.ibStatus,
      ibLevel: user.ibLevel,
      ibLevelOrder: user.ibLevelOrder,
      ibLevelId: user.ibLevelId,
      autoUpgradeEnabled: user.autoUpgradeEnabled,
      ibPlan: user.ibPlanId
    },
    wallet,
    stats: stats.stats,
    levelProgress
  })
}

// GET /api/ib/dashboard?userId= — spec alias for my-profile
router.get('/dashboard', async (req, res) => {
  try {
    const userId = userIdFromQuery(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query parameter is required' })
    }
    await sendIbDashboard(req, res, userId)
  } catch (error) {
    console.error('Error fetching IB dashboard:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/my-profile/:userId - Get IB profile
router.get('/my-profile/:userId', async (req, res) => {
  try {
    await sendIbDashboard(req, res, req.params.userId)
  } catch (error) {
    console.error('Error fetching IB profile:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/my-referrals/:userId - Get direct referrals
router.get('/my-referrals/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    
    const referrals = await User.find({ parentIBId: userId })
      .select('firstName email createdAt isIB ibStatus')
      .sort({ createdAt: -1 })

    res.json({ success: true, referrals })
  } catch (error) {
    console.error('Error fetching referrals:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/my-commissions/:userId - Get commission history
router.get('/my-commissions/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { limit = 50, offset = 0 } = req.query

    const commissions = await IBCommission.find({ ibUserId: userId })
      .populate('traderUserId', 'firstName email')
      .populate('tradeId', 'tradeId symbol side')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))

    const total = await IBCommission.countDocuments({ ibUserId: userId })

    res.json({ success: true, commissions, total })
  } catch (error) {
    console.error('Error fetching commissions:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/my-downline/:userId - Get downline tree
router.get('/my-downline/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { maxDepth = 5 } = req.query

    const tree = await ibEngine.getIBTree(
      new mongoose.Types.ObjectId(userId), 
      parseInt(maxDepth)
    )

    res.json({ success: true, tree })
  } catch (error) {
    console.error('Error fetching downline:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/referrals?userId= — spec
router.get('/referrals', async (req, res) => {
  try {
    const userId = userIdFromQuery(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query parameter is required' })
    }
    const referrals = await User.find({ parentIBId: userId })
      .select('firstName email createdAt isIB ibStatus')
      .sort({ createdAt: -1 })
    res.json({ success: true, referrals })
  } catch (error) {
    console.error('Error fetching referrals:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/commissions?userId= — spec
router.get('/commissions', async (req, res) => {
  try {
    const userId = userIdFromQuery(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query parameter is required' })
    }
    const { limit = 50, offset = 0 } = req.query
    const commissions = await IBCommission.find({ ibUserId: userId })
      .populate('traderUserId', 'firstName email')
      .populate('tradeId', 'tradeId symbol side')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset, 10))
      .limit(parseInt(limit, 10))
    const total = await IBCommission.countDocuments({ ibUserId: userId })
    res.json({ success: true, commissions, total })
  } catch (error) {
    console.error('Error fetching commissions:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/downline?userId= — spec
router.get('/downline', async (req, res) => {
  try {
    const userId = userIdFromQuery(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query parameter is required' })
    }
    const { maxDepth = 5 } = req.query
    const tree = await ibEngine.getIBTree(
      new mongoose.Types.ObjectId(userId),
      parseInt(maxDepth, 10)
    )
    res.json({ success: true, tree })
  } catch (error) {
    console.error('Error fetching downline:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/ib/withdraw - Withdraw to main wallet
router.post('/withdraw', async (req, res) => {
  try {
    const { userId, amount } = req.body
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid user ID and amount are required' })
    }

    const result = await ibEngine.withdrawToWallet(userId, parseFloat(amount))
    res.json({
      success: true,
      message: `Successfully withdrew $${amount} to main wallet`,
      ...result
    })
  } catch (error) {
    console.error('Error withdrawing:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// ==================== ADMIN ROUTES ====================

// GET /api/ib/admin/all - Get all IBs
router.get('/admin/all', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query

    let query = { isIB: true }
    if (status) query.ibStatus = status

    const ibs = await User.find(query)
      .populate('ibPlanId', 'name')
      .populate('parentIBId', 'firstName email referralCode')
      .populate('ibLevelId', 'name order commissionRate commissionType')
      .select('firstName email referralCode ibStatus ibLevel ibPlanId parentIBId ibLevelId ibLevelOrder createdAt')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))

    const total = await User.countDocuments(query)

    const ibIds = ibs.map((ib) => ib._id)
    const directCounts = await User.aggregate([
      { $match: { parentIBId: { $in: ibIds } } },
      { $group: { _id: '$parentIBId', count: { $sum: 1 } } }
    ])
    const directMap = new Map(directCounts.map((d) => [String(d._id), d.count]))

    // Get wallet balances for each IB
    const ibsWithWallets = await Promise.all(ibs.map(async (ib) => {
      const wallet = await IBWallet.findOne({ ibUserId: ib._id })
      return {
        ...ib.toObject(),
        walletBalance: wallet?.balance || 0,
        totalEarned: wallet?.totalEarned || 0,
        directReferralCount: directMap.get(String(ib._id)) || 0
      }
    }))

    res.json({ success: true, ibs: ibsWithWallets, total })
  } catch (error) {
    console.error('Error fetching IBs:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/pending - Get pending IB applications
router.get('/admin/pending', async (req, res) => {
  try {
    const pending = await User.find({ isIB: true, ibStatus: 'PENDING' })
      .select('firstName lastName email referralCode ibLevel createdAt parentIBId')
      .sort({ createdAt: -1 })

    const apps = await IBApplication.find({ status: 'PENDING' })
      .populate('userId', 'firstName lastName email createdAt')
      .populate('referredByIbUserId', 'firstName referralCode email')
      .sort({ appliedAt: -1 })

    res.json({ success: true, pending, applications: apps })
  } catch (error) {
    console.error('Error fetching pending IBs:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/requests — spec alias (?status=PENDING)
router.get('/admin/requests', async (req, res) => {
  try {
    const { status = 'PENDING' } = req.query
    const apps = await IBApplication.find({ status })
      .populate('userId', 'firstName lastName email createdAt')
      .populate('referredByIbUserId', 'firstName referralCode email')
      .sort({ appliedAt: -1 })
    res.json({ success: true, requests: apps })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/approve/:userId - Approve IB application
router.put('/admin/approve/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { planId, adminId, ibLevelId } = req.body

    const user = await ibEngine.approveIB(userId, planId, adminId || null, ibLevelId || null)
    res.json({
      success: true,
      message: 'IB approved successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        ibStatus: user.ibStatus,
        ibPlanId: user.ibPlanId
      }
    })
  } catch (error) {
    console.error('Error approving IB:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/reject/:userId - Reject IB application
router.put('/admin/reject/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { reason, adminId } = req.body

    const user = await ibEngine.rejectIBApplication(userId, reason, adminId || null)

    res.json({
      success: true,
      message: 'IB application rejected',
      user: {
        _id: user._id,
        firstName: user.firstName,
        ibStatus: user.ibStatus
      }
    })
  } catch (error) {
    console.error('Error rejecting IB:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/block/:userId - Block IB
router.put('/admin/block/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { reason } = req.body

    const user = await ibEngine.blockIB(userId, reason)
    res.json({
      success: true,
      message: 'IB blocked successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        ibStatus: user.ibStatus
      }
    })
  } catch (error) {
    console.error('Error blocking IB:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/unblock/:userId - Unblock IB
router.put('/admin/unblock/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')

    user.ibStatus = 'ACTIVE'
    await user.save()

    res.json({
      success: true,
      message: 'IB unblocked successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        ibStatus: user.ibStatus
      }
    })
  } catch (error) {
    console.error('Error unblocking IB:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/update/:userId - Update IB tier (IBLevel doc) and/or legacy chain depth
router.put('/admin/update/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { ibLevel, ibLevelId } = req.body

    const user = await User.findById(userId)
    if (!user) throw new Error('User not found')
    if (!user.isIB) throw new Error('User is not an IB')

    if (ibLevelId) {
      const lvl = await IBLevel.findOne({ _id: ibLevelId, isActive: true })
      if (!lvl) {
        return res.status(400).json({ success: false, message: 'Invalid or inactive IB tier' })
      }
      user.ibLevelId = lvl._id
      user.ibLevelOrder = lvl.order
    }

    if (ibLevel !== undefined && !ibLevelId) {
      user.ibLevel = parseInt(ibLevel, 10) || 1
    }

    await user.save()

    res.json({
      success: true,
      message: 'IB updated successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        ibLevel: user.ibLevel,
        ibLevelId: user.ibLevelId,
        ibLevelOrder: user.ibLevelOrder
      }
    })
  } catch (error) {
    console.error('Error updating IB:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/change-plan/:userId - Change IB plan
router.put('/admin/change-plan/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { planId } = req.body

    const user = await User.findById(userId)
    if (!user || !user.isIB) throw new Error('IB not found')

    user.ibPlanId = planId
    await user.save()

    res.json({
      success: true,
      message: 'IB plan changed successfully'
    })
  } catch (error) {
    console.error('Error changing plan:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/tree/:userId - Get IB tree for admin
router.get('/admin/tree/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { maxDepth = 5 } = req.query

    const tree = await ibEngine.getIBTree(
      new mongoose.Types.ObjectId(userId),
      parseInt(maxDepth)
    )

    res.json({ success: true, tree })
  } catch (error) {
    console.error('Error fetching IB tree:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/stats/:userId - Get IB stats for admin
router.get('/admin/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const stats = await ibEngine.getIBStats(userId)
    res.json({ success: true, ...stats })
  } catch (error) {
    console.error('Error fetching IB stats:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/ib/admin/reverse-commission - Reverse a commission
router.post('/admin/reverse-commission', async (req, res) => {
  try {
    const { commissionId, adminId, reason } = req.body
    if (!commissionId || !adminId) {
      return res.status(400).json({ success: false, message: 'Commission ID and Admin ID are required' })
    }

    const commission = await ibEngine.reverseCommission(commissionId, adminId, reason)
    res.json({
      success: true,
      message: 'Commission reversed successfully',
      commission
    })
  } catch (error) {
    console.error('Error reversing commission:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/commissions - Get all commissions
router.get('/admin/commissions', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query

    let query = {}
    if (status) query.status = status

    const commissions = await IBCommission.find(query)
      .populate('ibUserId', 'firstName email referralCode')
      .populate('traderUserId', 'firstName email')
      .populate('tradeId', 'tradeId symbol side quantity')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))

    const total = await IBCommission.countDocuments(query)

    // Calculate totals
    const totals = await IBCommission.aggregate([
      { $match: { status: 'CREDITED' } },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$commissionAmount' },
          totalTrades: { $sum: 1 }
        }
      }
    ])

    res.json({
      success: true,
      commissions,
      total,
      summary: {
        totalCommission: totals[0]?.totalCommission || 0,
        totalTrades: totals[0]?.totalTrades || 0
      }
    })
  } catch (error) {
    console.error('Error fetching commissions:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== PLAN ROUTES ====================

// GET /api/ib/plans - Get all active plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await IBPlan.find({ isActive: true }).sort({ createdAt: -1 })
    res.json({ success: true, plans })
  } catch (error) {
    console.error('Error fetching plans:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/plans - Get all plans (admin)
router.get('/admin/plans', async (req, res) => {
  try {
    const plans = await IBPlan.find().sort({ createdAt: -1 })
    
    // Transform plans to include levelCommissions format for frontend compatibility
    const transformedPlans = plans.map(plan => {
      const levelCommissions = {}
      if (plan.levels && Array.isArray(plan.levels)) {
        plan.levels.forEach(l => {
          levelCommissions[`level${l.level}`] = l.rate
        })
      }
      return {
        ...plan.toObject(),
        levelCommissions,
        commissionSources: plan.source
      }
    })
    
    res.json({ success: true, plans: transformedPlans })
  } catch (error) {
    console.error('Error fetching plans:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/ib/admin/plans - Create new plan
router.post('/admin/plans', async (req, res) => {
  try {
    const { name, description, maxLevels, commissionType, levelCommissions, commissionSources, minWithdrawalAmount, isDefault } = req.body

    if (!name) {
      return res.status(400).json({ success: false, message: 'Plan name is required' })
    }

    // Convert levelCommissions object to levels array for IBPlanNew.js compatibility
    const levels = []
    const lc = levelCommissions || { level1: 5, level2: 3, level3: 2, level4: 1, level5: 0.5 }
    for (let i = 1; i <= (maxLevels || 3); i++) {
      levels.push({ level: i, rate: lc[`level${i}`] || 0 })
    }

    const plan = await IBPlan.create({
      name,
      maxLevels: maxLevels || 3,
      commissionType: commissionType || 'PER_LOT',
      levels,
      source: commissionSources || { spread: true, tradeCommission: true, swap: false }
    })

    // If this is default, unset other defaults
    if (isDefault) {
      await IBPlan.updateMany(
        { _id: { $ne: plan._id } },
        { $set: { isDefault: false } }
      )
    }

    res.json({ success: true, message: 'Plan created successfully', plan })
  } catch (error) {
    console.error('Error creating plan:', error)
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A plan with this name already exists' })
    }
    res.status(400).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/plans/:planId - Update plan
router.put('/admin/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params
    const { name, description, maxLevels, commissionType, levelCommissions, commissionSources, minWithdrawalAmount, isActive, isDefault } = req.body

    const plan = await IBPlan.findById(planId)
    if (!plan) throw new Error('Plan not found')

    if (name) plan.name = name
    if (description !== undefined) plan.description = description
    if (maxLevels) plan.maxLevels = maxLevels
    if (commissionType) plan.commissionType = commissionType
    if (levelCommissions) plan.levelCommissions = levelCommissions
    if (commissionSources) plan.commissionSources = commissionSources
    if (minWithdrawalAmount !== undefined) plan.minWithdrawalAmount = minWithdrawalAmount
    if (isActive !== undefined) plan.isActive = isActive
    if (isDefault !== undefined) plan.isDefault = isDefault

    await plan.save()

    // If this is default, unset other defaults
    if (isDefault) {
      await IBPlan.updateMany(
        { _id: { $ne: plan._id } },
        { $set: { isDefault: false } }
      )
    }

    res.json({ success: true, message: 'Plan updated successfully', plan })
  } catch (error) {
    console.error('Error updating plan:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// DELETE /api/ib/admin/plans/:planId - Delete plan
router.delete('/admin/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params
    
    // Check if any IBs are using this plan
    const ibsUsingPlan = await User.countDocuments({ ibPlanId: planId })
    if (ibsUsingPlan > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete plan. ${ibsUsingPlan} IBs are using this plan.` 
      })
    }

    await IBPlan.findByIdAndDelete(planId)
    res.json({ success: true, message: 'Plan deleted successfully' })
  } catch (error) {
    console.error('Error deleting plan:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// POST /api/ib/admin/transfer-referrals - Transfer users to a different IB (hierarchy-safe)
router.post('/admin/transfer-referrals', async (req, res) => {
  try {
    const { userIds, targetIBId } = req.body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No users selected' })
    }

    if (!targetIBId) {
      return res.status(400).json({ success: false, message: 'Target IB not specified' })
    }

    // Find the target IB user
    const targetIB = await User.findById(targetIBId)
    if (!targetIB) {
      return res.status(404).json({ success: false, message: 'Target IB not found' })
    }

    // Verify target is an active IB
    if (!targetIB.isIB || targetIB.ibStatus !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Target user is not an active IB' })
    }

    let transferredCount = 0
    const errors = []

    for (const userId of userIds) {
      try {
        if (String(userId) === String(targetIBId)) {
          errors.push({ userId, message: 'Cannot assign IB to self' })
          continue
        }
        if (await wouldCreateReferralCycle(userId, targetIBId)) {
          errors.push({ userId, message: 'Would create hierarchy cycle (target is under this user)' })
          continue
        }
        const u = await User.findById(userId)
        if (!u) {
          errors.push({ userId, message: 'User not found' })
          continue
        }
        u.parentIBId = targetIB._id
        u.referredBy = targetIB.referralCode || null
        if (u.isIB && u.ibStatus === 'ACTIVE') {
          u.ibLevel = (targetIB.ibLevel || 1) + 1
        }
        await u.save()
        transferredCount++
        console.log(`Transferred user ${userId} to IB ${targetIBId}`)
      } catch (err) {
        console.error(`Error transferring user ${userId}:`, err)
        errors.push({ userId, message: err.message })
      }
    }

    console.log(`[Admin] Transferred ${transferredCount} users to IB ${targetIB.email}`)

    res.json({
      success: true,
      message: `Successfully transferred ${transferredCount} user(s)`,
      transferredCount,
      errors: errors.length ? errors : undefined
    })
  } catch (error) {
    console.error('Error transferring referrals:', error)
    res.status(500).json({ success: false, message: 'Error transferring referrals', error: error.message })
  }
})

// GET /api/ib/admin/referred-users — users under an IB (direct or full downline tree)
router.get('/admin/referred-users', async (req, res) => {
  try {
    const { ibId, scope = 'downline', search = '' } = req.query
    const searchRx = search ? new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null

    if (ibId) {
      const ib = await User.findById(ibId).select('firstName email referralCode isIB ibStatus')
      if (!ib?.isIB) {
        return res.status(404).json({ success: false, message: 'IB not found' })
      }

      if (scope === 'direct') {
        let q = { parentIBId: ib._id }
        if (searchRx) {
          q = {
            parentIBId: ib._id,
            $or: [{ firstName: searchRx }, { email: searchRx }]
          }
        }
        const users = await User.find(q)
          .select('firstName email isIB ibStatus parentIBId referredBy createdAt')
          .populate('parentIBId', 'firstName email referralCode')
          .sort({ createdAt: -1 })
          .limit(500)
          .lean()

        return res.json({
          success: true,
          scope: 'direct',
          ib: {
            _id: ib._id,
            firstName: ib.firstName,
            email: ib.email,
            referralCode: ib.referralCode
          },
          users: users.map((u) => ({ ...u, depth: 1 }))
        })
      }

      const tree = await ibEngine.getIBTree(ib._id, 25)
      const raw = tree?.downlines || []
      const parentIds = [...new Set(raw.map((u) => u.parentIBId).filter(Boolean).map(String))]
      const parents = await User.find({ _id: { $in: parentIds } })
        .select('firstName email referralCode')
        .lean()
      const pById = Object.fromEntries(parents.map((p) => [String(p._id), p]))

      let users = raw.map((u) => ({
        _id: u._id,
        firstName: u.firstName,
        email: u.email,
        isIB: u.isIB,
        ibStatus: u.ibStatus,
        parentIBId: u.parentIBId,
        referredBy: u.referredBy,
        depth: (u.level ?? 0) + 1,
        parentIB: u.parentIBId ? pById[String(u.parentIBId)] : null
      }))

      if (searchRx) {
        users = users.filter(
          (u) => searchRx.test(u.firstName || '') || searchRx.test(u.email || '')
        )
      }

      return res.json({
        success: true,
        scope: 'downline',
        ib: {
          _id: ib._id,
          firstName: ib.firstName,
          email: ib.email,
          referralCode: ib.referralCode
        },
        users
      })
    }

    // No ibId: all users attached to any IB (flat list for admin overview)
    let q = { parentIBId: { $ne: null } }
    if (searchRx) {
      q = {
        parentIBId: { $ne: null },
        $or: [{ firstName: searchRx }, { email: searchRx }]
      }
    }
    const users = await User.find(q)
      .select('firstName email isIB ibStatus parentIBId referredBy createdAt')
      .populate('parentIBId', 'firstName email referralCode isIB')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    return res.json({ success: true, scope: 'all', ib: null, users })
  } catch (error) {
    console.error('Error fetching referred users:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/ib/admin/detach-referrals — remove user(s) from IB tree (no parent)
router.post('/admin/detach-referrals', async (req, res) => {
  try {
    const { userIds } = req.body
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds array required' })
    }

    let detached = 0
    for (const id of userIds) {
      const u = await User.findById(id)
      if (!u) continue
      u.parentIBId = null
      u.referredBy = null
      await u.save()
      detached++
    }

    res.json({ success: true, message: `Detached ${detached} user(s) from IB`, detachedCount: detached })
  } catch (error) {
    console.error('Error detaching referrals:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/dashboard - Admin dashboard stats
router.get('/admin/dashboard', async (req, res) => {
  try {
    const totalIBs = await User.countDocuments({ isIB: true })
    const activeIBs = await User.countDocuments({ isIB: true, ibStatus: 'ACTIVE' })
    const pendingIBs = await User.countDocuments({ isIB: true, ibStatus: 'PENDING' })

    const commissionStats = await IBCommission.aggregate([
      { $match: { status: 'CREDITED' } },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$commissionAmount' },
          totalTrades: { $sum: 1 }
        }
      }
    ])

    const walletStats = await IBWallet.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' },
          totalEarned: { $sum: '$totalEarned' },
          totalWithdrawn: { $sum: '$totalWithdrawn' }
        }
      }
    ])

    res.json({
      success: true,
      stats: {
        totalIBs,
        activeIBs,
        pendingIBs,
        totalCommissionPaid: commissionStats[0]?.totalCommission || 0,
        totalTradesWithCommission: commissionStats[0]?.totalTrades || 0,
        totalIBWalletBalance: walletStats[0]?.totalBalance || 0,
        totalIBEarnings: walletStats[0]?.totalEarned || 0,
        totalIBWithdrawals: walletStats[0]?.totalWithdrawn || 0
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/directory — root IBs + downline trees (spec)
router.get('/admin/directory', async (req, res) => {
  try {
    const { maxDepth = 6 } = req.query
    const roots = await User.find({
      isIB: true,
      ibStatus: 'ACTIVE',
      $or: [{ parentIBId: null }, { parentIBId: { $exists: false } }]
    })
      .select('firstName email referralCode ibLevel createdAt')
      .sort({ createdAt: -1 })

    const trees = await Promise.all(
      roots.map(async (r) => {
        const tree = await ibEngine.getIBTree(r._id, parseInt(maxDepth, 10))
        const wallet = await IBWallet.findOne({ ibUserId: r._id })
        const direct = await User.countDocuments({ parentIBId: r._id })
        return {
          ib: r.toObject(),
          directReferrals: direct,
          walletBalance: wallet?.balance || 0,
          totalEarned: wallet?.totalEarned || 0,
          tree
        }
      })
    )

    res.json({ success: true, directory: trees })
  } catch (error) {
    console.error('Error fetching IB directory:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/directory/:id — single IB detail + tree
router.get('/admin/directory/:id', async (req, res) => {
  try {
    const { maxDepth = 8 } = req.query
    const ib = await User.findById(req.params.id).select('-password')
    if (!ib?.isIB) {
      return res.status(404).json({ success: false, message: 'IB not found' })
    }
    const stats = await ibEngine.getIBStats(req.params.id)
    const tree = await ibEngine.getIBTree(new mongoose.Types.ObjectId(req.params.id), parseInt(maxDepth, 10))
    res.json({ success: true, ib, stats, tree })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/ib/admin/requests/:id/approve — spec (by application id)
router.post('/admin/requests/:id/approve', async (req, res) => {
  try {
    const application = await IBApplication.findById(req.params.id)
    if (!application || application.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Pending application not found' })
    }
    const { planId, adminId, ibLevelId } = req.body
    const user = await ibEngine.approveIB(
      application.userId.toString(),
      planId,
      adminId || null,
      ibLevelId || null
    )
    res.json({
      success: true,
      message: 'IB approved',
      user: { _id: user._id, ibStatus: user.ibStatus, referralCode: user.referralCode }
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// POST /api/ib/admin/requests/:id/reject
router.post('/admin/requests/:id/reject', async (req, res) => {
  try {
    const application = await IBApplication.findById(req.params.id)
    if (!application || application.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Pending application not found' })
    }
    const { reason, adminId } = req.body
    const user = await ibEngine.rejectIBApplication(application.userId.toString(), reason, adminId || null)
    res.json({ success: true, message: 'Application rejected', user: { _id: user._id, ibStatus: user.ibStatus } })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/commission-config — per account type, multi-level %
router.get('/admin/commission-config', async (req, res) => {
  try {
    await ibEngine.ensureDefaultCommissionConfigs()
    const grouped = await ibEngine.getCommissionConfigsGrouped()
    const accountTypes = await AccountType.find({}).sort({ name: 1 })
    res.json({ success: true, configs: grouped, accountTypes })
  } catch (error) {
    console.error('Error fetching commission config:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/commission-config — body: { accountTypeId, levels: [{ level, commissionPercent, isActive }] }
router.put('/admin/commission-config', async (req, res) => {
  try {
    const { accountTypeId, levels } = req.body
    if (!accountTypeId || !Array.isArray(levels)) {
      return res.status(400).json({ success: false, message: 'accountTypeId and levels[] required' })
    }
    const result = await ibEngine.replaceCommissionConfigForAccountType(accountTypeId, levels)
    res.json({ success: true, message: 'Commission configuration saved', ...result })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/ledger — full commission ledger (spec alias)
router.get('/admin/ledger', async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query
    let query = {}
    if (status) query.status = status

    const commissions = await IBCommission.find(query)
      .populate('ibUserId', 'firstName email referralCode')
      .populate('traderUserId', 'firstName email')
      .populate('tradeId', 'tradeId symbol side quantity')
      .populate('accountTypeId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset, 10))
      .limit(parseInt(limit, 10))

    const total = await IBCommission.countDocuments(query)
    res.json({ success: true, ledger: commissions, total })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== IB LEVEL ROUTES ====================

// GET /api/ib/levels - Get all IB levels (public)
router.get('/levels', async (req, res) => {
  try {
    let levels = await IBLevel.getAllLevels()
    if (levels.length === 0) {
      await IBLevel.initializeDefaultLevels()
      levels = await IBLevel.getAllLevels()
    }
    res.json({ success: true, levels })
  } catch (error) {
    console.error('Error fetching levels:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/ib/admin/levels - Get all IB levels (admin)
router.get('/admin/levels', async (req, res) => {
  try {
    let levels = await IBLevel.find().sort({ order: 1 })
    if (levels.length === 0) {
      await IBLevel.initializeDefaultLevels()
      levels = await IBLevel.find().sort({ order: 1 })
    }
    res.json({ success: true, levels })
  } catch (error) {
    console.error('Error fetching levels:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/ib/admin/levels - Create new IB level
router.post('/admin/levels', async (req, res) => {
  try {
    const { name, order, referralTarget, commissionRate, commissionType, downlineCommission, color, icon } = req.body

    if (!name || order === undefined) {
      return res.status(400).json({ success: false, message: 'Name and order are required' })
    }

    // Check if order already exists
    const existingOrder = await IBLevel.findOne({ order })
    if (existingOrder) {
      return res.status(400).json({ success: false, message: 'A level with this order already exists' })
    }

    const level = await IBLevel.create({
      name,
      order,
      referralTarget: referralTarget || 0,
      commissionRate: commissionRate || 0,
      commissionType: commissionType || 'PER_LOT',
      downlineCommission: downlineCommission || { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 },
      color: color || '#10B981',
      icon: icon || 'award'
    })

    res.json({ success: true, message: 'Level created successfully', level })
  } catch (error) {
    console.error('Error creating level:', error)
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A level with this name already exists' })
    }
    res.status(400).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/levels/:levelId - Update IB level
router.put('/admin/levels/:levelId', async (req, res) => {
  try {
    const { levelId } = req.params
    const { name, order, referralTarget, commissionRate, commissionType, downlineCommission, color, icon, isActive } = req.body

    const level = await IBLevel.findById(levelId)
    if (!level) {
      return res.status(404).json({ success: false, message: 'Level not found' })
    }

    // Check if new order conflicts with existing level
    if (order !== undefined && order !== level.order) {
      const existingOrder = await IBLevel.findOne({ order, _id: { $ne: levelId } })
      if (existingOrder) {
        return res.status(400).json({ success: false, message: 'A level with this order already exists' })
      }
    }

    if (name !== undefined) level.name = name
    if (order !== undefined) level.order = order
    if (referralTarget !== undefined) level.referralTarget = referralTarget
    if (commissionRate !== undefined) level.commissionRate = commissionRate
    if (commissionType !== undefined) level.commissionType = commissionType
    if (downlineCommission !== undefined) level.downlineCommission = downlineCommission
    if (color !== undefined) level.color = color
    if (icon !== undefined) level.icon = icon
    if (isActive !== undefined) level.isActive = isActive

    await level.save()

    res.json({ success: true, message: 'Level updated successfully', level })
  } catch (error) {
    console.error('Error updating level:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// DELETE /api/ib/admin/levels/:levelId - Delete IB level
router.delete('/admin/levels/:levelId', async (req, res) => {
  try {
    const { levelId } = req.params

    // Check if any IBs are using this level
    const ibsUsingLevel = await User.countDocuments({ ibLevelId: levelId })
    if (ibsUsingLevel > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete level. ${ibsUsingLevel} IBs are at this level.` 
      })
    }

    await IBLevel.findByIdAndDelete(levelId)
    res.json({ success: true, message: 'Level deleted successfully' })
  } catch (error) {
    console.error('Error deleting level:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/user-level/:userId - Manually change user's IB level
router.put('/admin/user-level/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { levelId } = req.body

    const user = await User.findById(userId)
    if (!user || !user.isIB) {
      return res.status(404).json({ success: false, message: 'IB not found' })
    }

    const level = await IBLevel.findById(levelId)
    if (!level) {
      return res.status(404).json({ success: false, message: 'Level not found' })
    }

    user.ibLevelId = level._id
    user.ibLevelOrder = level.order
    await user.save()

    res.json({ 
      success: true, 
      message: `User level changed to ${level.name}`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        ibLevelId: user.ibLevelId,
        ibLevelOrder: user.ibLevelOrder
      }
    })
  } catch (error) {
    console.error('Error changing user level:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/toggle-auto-upgrade/:userId - Toggle auto-upgrade for user
router.put('/toggle-auto-upgrade/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { enabled } = req.body

    const user = await User.findById(userId)
    if (!user || !user.isIB) {
      return res.status(404).json({ success: false, message: 'IB not found' })
    }

    user.autoUpgradeEnabled = enabled !== undefined ? enabled : !user.autoUpgradeEnabled
    await user.save()

    res.json({ 
      success: true, 
      message: `Auto-upgrade ${user.autoUpgradeEnabled ? 'enabled' : 'disabled'}`,
      autoUpgradeEnabled: user.autoUpgradeEnabled
    })
  } catch (error) {
    console.error('Error toggling auto-upgrade:', error)
    res.status(400).json({ success: false, message: error.message })
  }
})

// POST /api/ib/admin/init-levels - Initialize default levels
router.post('/admin/init-levels', async (req, res) => {
  try {
    await IBLevel.initializeDefaultLevels()
    const levels = await IBLevel.getAllLevels()
    res.json({ success: true, message: 'Default levels initialized', levels })
  } catch (error) {
    console.error('Error initializing levels:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== SETTINGS ROUTES ====================

// GET /api/ib/admin/settings - Get IB settings
router.get('/admin/settings', async (req, res) => {
  try {
    const settings = await IBSettings.getSettings()
    res.json({ success: true, settings })
  } catch (error) {
    console.error('Error fetching IB settings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/ib/admin/settings - Update IB settings
router.put('/admin/settings', async (req, res) => {
  try {
    const settings = await IBSettings.getSettings()
    const { 
      ibRequirements, 
      commissionSettings, 
      isEnabled, 
      allowNewApplications, 
      autoApprove 
    } = req.body

    if (ibRequirements) {
      settings.ibRequirements = { ...settings.ibRequirements, ...ibRequirements }
    }
    if (commissionSettings) {
      settings.commissionSettings = { ...settings.commissionSettings, ...commissionSettings }
    }
    if (isEnabled !== undefined) settings.isEnabled = isEnabled
    if (allowNewApplications !== undefined) settings.allowNewApplications = allowNewApplications
    if (autoApprove !== undefined) settings.autoApprove = autoApprove

    await settings.save()
    res.json({ success: true, settings })
  } catch (error) {
    console.error('Error updating IB settings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
