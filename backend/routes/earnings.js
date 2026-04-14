import express from 'express'
import Trade from '../models/Trade.js'
import CopyTrade from '../models/CopyTrade.js'
import CopyCommission from '../models/CopyCommission.js'
import MasterTrader from '../models/MasterTrader.js'

const router = express.Router()

function parseEarningsDateRange(req) {
  const { startDate, endDate, days = 30 } = req.query
  let start
  let end
  if (startDate && endDate) {
    start = new Date(startDate)
    end = new Date(endDate)
  } else {
    end = new Date()
    start = new Date()
    start.setDate(start.getDate() - parseInt(days, 10))
  }
  return { start, end }
}

// GET /api/earnings/summary - Get earnings summary (daily, weekly, monthly)
router.get('/summary', async (req, res) => {
  try {
    const now = new Date()
    
    // Calculate date ranges
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week (Sunday)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    // Aggregate earnings from trades
    const aggregateEarnings = async (startDate, endDate = now) => {
      const result = await Trade.aggregate([
        {
          $match: {
            openedAt: { $gte: startDate, $lte: endDate },
            status: { $in: ['OPEN', 'CLOSED'] }
          }
        },
        {
          $group: {
            _id: null,
            totalCommission: { $sum: '$commission' },
            totalSpread: { $sum: '$spread' },
            totalSwap: { $sum: '$swap' },
            tradeCount: { $sum: 1 },
            totalVolume: { $sum: '$quantity' }
          }
        }
      ])
      
      if (result.length === 0) {
        return { totalCommission: 0, totalSpread: 0, totalSwap: 0, tradeCount: 0, totalVolume: 0 }
      }
      
      return result[0]
    }

    const [today, thisWeek, thisMonth, thisYear, allTime] = await Promise.all([
      aggregateEarnings(todayStart),
      aggregateEarnings(weekStart),
      aggregateEarnings(monthStart),
      aggregateEarnings(yearStart),
      aggregateEarnings(new Date(0)) // All time
    ])

    res.json({
      success: true,
      earnings: {
        today: {
          commission: today.totalCommission,
          spread: today.totalSpread,
          swap: today.totalSwap,
          total: today.totalCommission + today.totalSwap,
          trades: today.tradeCount,
          volume: today.totalVolume
        },
        thisWeek: {
          commission: thisWeek.totalCommission,
          spread: thisWeek.totalSpread,
          swap: thisWeek.totalSwap,
          total: thisWeek.totalCommission + thisWeek.totalSwap,
          trades: thisWeek.tradeCount,
          volume: thisWeek.totalVolume
        },
        thisMonth: {
          commission: thisMonth.totalCommission,
          spread: thisMonth.totalSpread,
          swap: thisMonth.totalSwap,
          total: thisMonth.totalCommission + thisMonth.totalSwap,
          trades: thisMonth.tradeCount,
          volume: thisMonth.totalVolume
        },
        thisYear: {
          commission: thisYear.totalCommission,
          spread: thisYear.totalSpread,
          swap: thisYear.totalSwap,
          total: thisYear.totalCommission + thisYear.totalSwap,
          trades: thisYear.tradeCount,
          volume: thisYear.totalVolume
        },
        allTime: {
          commission: allTime.totalCommission,
          spread: allTime.totalSpread,
          swap: allTime.totalSwap,
          total: allTime.totalCommission + allTime.totalSwap,
          trades: allTime.tradeCount,
          volume: allTime.totalVolume
        }
      }
    })
  } catch (error) {
    console.error('Error fetching earnings summary:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/earnings/daily - Get daily earnings breakdown for a date range
router.get('/daily', async (req, res) => {
  try {
    const { startDate, endDate, days = 30 } = req.query
    
    let start, end
    if (startDate && endDate) {
      start = new Date(startDate)
      end = new Date(endDate)
    } else {
      end = new Date()
      start = new Date()
      start.setDate(start.getDate() - parseInt(days))
    }

    const dailyEarnings = await Trade.aggregate([
      {
        $match: {
          openedAt: { $gte: start, $lte: end },
          status: { $in: ['OPEN', 'CLOSED'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$openedAt' },
            month: { $month: '$openedAt' },
            day: { $dayOfMonth: '$openedAt' }
          },
          commission: { $sum: '$commission' },
          spread: { $sum: '$spread' },
          swap: { $sum: '$swap' },
          trades: { $sum: 1 },
          volume: { $sum: '$quantity' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ])

    // Format the results
    const formatted = dailyEarnings.map(day => ({
      date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
      commission: day.commission,
      spread: day.spread,
      swap: day.swap,
      total: day.commission + day.swap,
      trades: day.trades,
      volume: day.volume
    }))

    res.json({ success: true, earnings: formatted })
  } catch (error) {
    console.error('Error fetching daily earnings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/earnings/by-user - Get earnings breakdown by user
router.get('/by-user', async (req, res) => {
  try {
    const { startDate, endDate, days = 30 } = req.query
    
    let start, end
    if (startDate && endDate) {
      start = new Date(startDate)
      end = new Date(endDate)
    } else {
      end = new Date()
      start = new Date()
      start.setDate(start.getDate() - parseInt(days))
    }

    const userEarnings = await Trade.aggregate([
      {
        $match: {
          openedAt: { $gte: start, $lte: end },
          status: { $in: ['OPEN', 'CLOSED'] }
        }
      },
      {
        $group: {
          _id: '$userId',
          commission: { $sum: '$commission' },
          spread: { $sum: '$spread' },
          swap: { $sum: '$swap' },
          trades: { $sum: 1 },
          volume: { $sum: '$quantity' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: '$_id',
          userName: '$user.name',
          userEmail: '$user.email',
          commission: 1,
          spread: 1,
          swap: 1,
          total: { $add: ['$commission', '$swap'] },
          trades: 1,
          volume: 1
        }
      },
      {
        $sort: { total: -1 }
      }
    ])

    res.json({ success: true, earnings: userEarnings })
  } catch (error) {
    console.error('Error fetching user earnings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/earnings/by-symbol - Get earnings breakdown by symbol
router.get('/by-symbol', async (req, res) => {
  try {
    const { startDate, endDate, days = 30 } = req.query
    
    let start, end
    if (startDate && endDate) {
      start = new Date(startDate)
      end = new Date(endDate)
    } else {
      end = new Date()
      start = new Date()
      start.setDate(start.getDate() - parseInt(days))
    }

    const symbolEarnings = await Trade.aggregate([
      {
        $match: {
          openedAt: { $gte: start, $lte: end },
          status: { $in: ['OPEN', 'CLOSED'] }
        }
      },
      {
        $group: {
          _id: '$symbol',
          commission: { $sum: '$commission' },
          spread: { $sum: '$spread' },
          swap: { $sum: '$swap' },
          trades: { $sum: 1 },
          volume: { $sum: '$quantity' }
        }
      },
      {
        $project: {
          symbol: '$_id',
          commission: 1,
          spread: 1,
          swap: 1,
          total: { $add: ['$commission', '$swap'] },
          trades: 1,
          volume: 1
        }
      },
      {
        $sort: { total: -1 }
      }
    ])

    res.json({ success: true, earnings: symbolEarnings })
  } catch (error) {
    console.error('Error fetching symbol earnings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

function followerCopyFeesPipeline(tradeCollection, rangeStart, rangeEnd, groupByMaster) {
  const groupStage = groupByMaster
    ? {
        $group: {
          _id: '$masterId',
          commission: { $sum: '$ft.commission' },
          spread: { $sum: '$ft.spread' },
          swap: { $sum: '$ft.swap' },
          followerTrades: { $sum: 1 },
          volume: { $sum: '$ft.quantity' }
        }
      }
    : {
        $group: {
          _id: null,
          commission: { $sum: '$ft.commission' },
          spread: { $sum: '$ft.spread' },
          swap: { $sum: '$ft.swap' },
          followerTrades: { $sum: 1 },
          volume: { $sum: '$ft.quantity' }
        }
      }
  return [
    { $match: { followerTradeId: { $ne: null } } },
    {
      $lookup: {
        from: tradeCollection,
        localField: 'followerTradeId',
        foreignField: '_id',
        as: 'ft'
      }
    },
    { $unwind: '$ft' },
    {
      $match: {
        'ft.openedAt': { $gte: rangeStart, $lte: rangeEnd },
        'ft.status': { $in: ['OPEN', 'CLOSED'] }
      }
    },
    groupStage
  ]
}

function masterOwnFeesPipeline(masterCollection, rangeStart, rangeEnd, groupByMaster) {
  const groupStage = groupByMaster
    ? {
        $group: {
          _id: { $arrayElemAt: ['$_m._id', 0] },
          commission: { $sum: '$commission' },
          spread: { $sum: '$spread' },
          swap: { $sum: '$swap' },
          masterTrades: { $sum: 1 },
          volume: { $sum: '$quantity' }
        }
      }
    : {
        $group: {
          _id: null,
          commission: { $sum: '$commission' },
          spread: { $sum: '$spread' },
          swap: { $sum: '$swap' },
          masterTrades: { $sum: 1 },
          volume: { $sum: '$quantity' }
        }
      }
  return [
    {
      $match: {
        openedAt: { $gte: rangeStart, $lte: rangeEnd },
        status: { $in: ['OPEN', 'CLOSED'] }
      }
    },
    {
      $lookup: {
        from: masterCollection,
        let: { uid: '$userId', tid: '$tradingAccountId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$userId', '$$uid'] }, { $eq: ['$tradingAccountId', '$$tid'] }]
              }
            }
          }
        ],
        as: '_m'
      }
    },
    { $match: { '_m.0': { $exists: true } } },
    groupStage
  ]
}

function mergeGlobalSlices(followerRow, masterRow) {
  const f = followerRow || {
    commission: 0,
    spread: 0,
    swap: 0,
    followerTrades: 0,
    volume: 0
  }
  const o = masterRow || {
    commission: 0,
    spread: 0,
    swap: 0,
    masterTrades: 0,
    volume: 0
  }
  const commission = (f.commission || 0) + (o.commission || 0)
  const spread = (f.spread || 0) + (o.spread || 0)
  const swap = (f.swap || 0) + (o.swap || 0)
  return {
    commission,
    spread,
    swap,
    total: commission + swap,
    followerTrades: f.followerTrades || 0,
    masterTrades: o.masterTrades || 0,
    trades: (f.followerTrades || 0) + (o.masterTrades || 0),
    volume: (f.volume || 0) + (o.volume || 0)
  }
}

// GET /api/earnings/by-copy-master — Platform earnings tied to each copy master (follower copy trades + master's own account trades)
router.get('/by-copy-master', async (req, res) => {
  try {
    const { start, end } = parseEarningsDateRange(req)
    const tradeCollection = Trade.collection.name
    const masterCollection = MasterTrader.collection.name
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const epoch = new Date(0)

    const fromYMD = start.toISOString().split('T')[0]
    const toYMD = end.toISOString().split('T')[0]
    const todayYMD = now.toISOString().split('T')[0]
    const copyCommissionStatuses = ['DEDUCTED', 'SETTLED']

    const [
      followerAgg,
      masterOwnAgg,
      masters,
      followerTodayAgg,
      masterTodayAgg,
      followerAllAgg,
      masterAllAgg,
      adminShareByMaster,
      adminShareToday,
      adminShareAllTime
    ] = await Promise.all([
      CopyTrade.aggregate(followerCopyFeesPipeline(tradeCollection, start, end, true)),
      Trade.aggregate(masterOwnFeesPipeline(masterCollection, start, end, true)),
      MasterTrader.find({})
        .select('displayName status userId tradingAccountId')
        .populate('userId', 'email firstName')
        .lean(),
      CopyTrade.aggregate(followerCopyFeesPipeline(tradeCollection, todayStart, now, false)),
      Trade.aggregate(masterOwnFeesPipeline(masterCollection, todayStart, now, false)),
      CopyTrade.aggregate(followerCopyFeesPipeline(tradeCollection, epoch, now, false)),
      Trade.aggregate(masterOwnFeesPipeline(masterCollection, epoch, now, false)),
      CopyCommission.aggregate([
        {
          $match: {
            tradingDay: { $gte: fromYMD, $lte: toYMD },
            status: { $in: copyCommissionStatuses }
          }
        },
        {
          $group: {
            _id: '$masterId',
            adminCommission: { $sum: '$adminShare' }
          }
        }
      ]),
      CopyCommission.aggregate([
        {
          $match: {
            tradingDay: todayYMD,
            status: { $in: copyCommissionStatuses }
          }
        },
        { $group: { _id: null, adminCommission: { $sum: '$adminShare' } } }
      ]),
      CopyCommission.aggregate([
        { $match: { status: { $in: copyCommissionStatuses } } },
        { $group: { _id: null, adminCommission: { $sum: '$adminShare' } } }
      ])
    ])

    const adminByMaster = new Map(adminShareByMaster.map((r) => [String(r._id), r.adminCommission || 0]))

    const followerByMaster = new Map(followerAgg.map((r) => [String(r._id), r]))
    const masterOwnByMaster = new Map(masterOwnAgg.map((r) => [String(r._id), r]))

    const rows = masters.map((m) => {
      const id = String(m._id)
      const f = followerByMaster.get(id) || {
        commission: 0,
        spread: 0,
        swap: 0,
        followerTrades: 0,
        volume: 0
      }
      const o = masterOwnByMaster.get(id) || {
        commission: 0,
        spread: 0,
        swap: 0,
        masterTrades: 0,
        volume: 0
      }
      const commission = (f.commission || 0) + (o.commission || 0)
      const swap = (f.swap || 0) + (o.swap || 0)
      const adminCommission = adminByMaster.get(id) || 0
      const u = m.userId
      return {
        masterId: m._id,
        displayName: m.displayName,
        status: m.status,
        masterEmail: u?.email || '',
        userName: u?.firstName || '',
        commission,
        adminCommission,
        swap,
        total: commission + swap,
        followerTrades: f.followerTrades || 0,
        masterTrades: o.masterTrades || 0,
        trades: (f.followerTrades || 0) + (o.masterTrades || 0),
        volume: (f.volume || 0) + (o.volume || 0)
      }
    })

    rows.sort((a, b) => b.total - a.total)

    const totals = rows.reduce(
      (acc, r) => {
        const id = String(r.masterId)
        const f = followerByMaster.get(id) || {}
        const o = masterOwnByMaster.get(id) || {}
        acc.commission += r.commission
        acc.spread += (f.spread || 0) + (o.spread || 0)
        acc.adminCommission += r.adminCommission
        acc.swap += r.swap
        acc.total += r.total
        acc.followerTrades += r.followerTrades
        acc.masterTrades += r.masterTrades
        acc.trades += r.trades
        acc.volume += r.volume
        return acc
      },
      {
        commission: 0,
        spread: 0,
        adminCommission: 0,
        swap: 0,
        total: 0,
        followerTrades: 0,
        masterTrades: 0,
        trades: 0,
        volume: 0
      }
    )

    const totalsToday = {
      ...mergeGlobalSlices(followerTodayAgg[0], masterTodayAgg[0]),
      adminCommission: adminShareToday[0]?.adminCommission || 0
    }
    const totalsAllTime = {
      ...mergeGlobalSlices(followerAllAgg[0], masterAllAgg[0]),
      adminCommission: adminShareAllTime[0]?.adminCommission || 0
    }

    res.json({
      success: true,
      earnings: rows,
      totals,
      totalsToday,
      totalsAllTime,
      period: { start, end }
    })
  } catch (error) {
    console.error('Error fetching copy-master earnings:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
