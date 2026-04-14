import express from 'express'
import Charges from '../models/Charges.js'
import AccountType from '../models/AccountType.js'

const router = express.Router()

// GET /api/charges/spreads - Get spreads for all instruments (for display in trading UI)
router.get('/spreads', async (req, res) => {
  try {
    const { userId, accountTypeId } = req.query
    
    // Get all charges that have spread values
    const charges = await Charges.find({ isActive: true, spreadValue: { $gt: 0 } })
      .sort({ level: 1 })
    
    // Filter charges based on accountTypeId if provided
    const filteredCharges = charges.filter(charge => {
      // ACCOUNT_TYPE level - only include if matches the provided accountTypeId
      if (charge.level === 'ACCOUNT_TYPE') {
        if (!accountTypeId) return false // Skip if no accountTypeId provided
        return charge.accountTypeId?.toString() === accountTypeId
      }
      // USER level - only include if matches userId
      if (charge.level === 'USER') {
        if (!userId) return false
        return charge.userId?.toString() === userId
      }
      // Include all other levels (SEGMENT, GLOBAL, INSTRUMENT)
      return true
    })
    
    // Sort by priority (most specific first)
    const priorityOrder = { 'USER': 1, 'INSTRUMENT': 2, 'ACCOUNT_TYPE': 3, 'SEGMENT': 4, 'GLOBAL': 5 }
    filteredCharges.sort((a, b) => priorityOrder[a.level] - priorityOrder[b.level])
    
    // Build a map of symbol -> spread (most specific wins)
    const spreadMap = {}
    
    const segmentSymbols = {
      'Forex': ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD', 'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'AUDCAD', 'AUDJPY', 'CADJPY', 'EURAUD', 'NZDCHF', 'NZDJPY', 'AUDNZD', 'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD', 'CADCHF', 'CHFJPY', 'EURCAD', 'EURNZD', 'USDHKD', 'USDSGD', 'USDMXN', 'USDZAR', 'USDTRY', 'USDPLN', 'USDSEK', 'USDNOK', 'USDDKK'],
      'Metals': ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'XAUEUR', 'XAUAUD', 'XAUGBP', 'XAUCHF', 'XAUJPY', 'XAGEUR'],
      'Crypto': ['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'BNBUSD', 'SOLUSD', 'ADAUSD', 'DOGEUSD', 'DOTUSD', 'MATICUSD', 'AVAXUSD', 'LINKUSD', 'SHIBUSD', 'UNIUSD', 'ATOMUSD', 'APTUSD', 'ARBUSD', 'AXSUSD', 'BLURUSD', 'FETUSD', 'FILUSD', 'FLOWUSD', 'FTMUSD', 'GALAUSD', 'GMTUSD', 'GRTUSD', 'ICPUSD', 'IMXUSD', 'INJUSD', 'LDOUSD', 'MANAUSD', 'NEARUSD', 'OPUSD', 'PEPEUSD', 'SANDUSD', 'SEIUSD', 'STXUSD', 'SUIUSD', 'TIAUSD', 'TONUSD', 'TRXUSD', 'VETUSD', 'WLDUSD', 'XLMUSD', 'XMRUSD', 'XTZUSD', 'ZECUSD', 'ETCUSD', 'AABORUSD', 'ALGOUSD', 'EOSUSD', 'THETAUSD'],
      'Indices': ['US30', 'US500', 'NAS100', 'UK100', 'GER40', 'FRA40', 'JPN225', 'AUS200', 'SPX500', 'DJ30', 'USTEC', 'USDX', 'VIX'],
      'Commodities': ['USOIL', 'UKOIL', 'NGAS']
    }
    const allSymbols = Object.values(segmentSymbols).flat()
    
    // Process charges in priority order (most specific first sets the value)
    for (const charge of filteredCharges) {
      // For instrument-specific charges
      if (charge.instrumentSymbol) {
        if (!spreadMap[charge.instrumentSymbol]) {
          spreadMap[charge.instrumentSymbol] = {
            spread: charge.spreadValue,
            spreadType: charge.spreadType,
            level: charge.level
          }
        }
      }
      // For ACCOUNT_TYPE level - apply to all symbols if no specific segment
      else if (charge.level === 'ACCOUNT_TYPE') {
        const symbolsToApply = charge.segment ? (segmentSymbols[charge.segment] || []) : allSymbols
        for (const symbol of symbolsToApply) {
          if (!spreadMap[symbol]) {
            spreadMap[symbol] = {
              spread: charge.spreadValue,
              spreadType: charge.spreadType,
              level: charge.level
            }
          }
        }
      }
      // For segment-level charges
      else if (charge.segment || charge.level === 'SEGMENT') {
        const symbolsToApply = charge.segment ? (segmentSymbols[charge.segment] || []) : allSymbols
        for (const symbol of symbolsToApply) {
          if (!spreadMap[symbol]) {
            spreadMap[symbol] = {
              spread: charge.spreadValue,
              spreadType: charge.spreadType,
              level: charge.level
            }
          }
        }
      }
      // For global charges
      else if (charge.level === 'GLOBAL') {
        for (const symbol of allSymbols) {
          if (!spreadMap[symbol]) {
            spreadMap[symbol] = {
              spread: charge.spreadValue,
              spreadType: charge.spreadType,
              level: charge.level
            }
          }
        }
      }
    }
    
    res.json({ success: true, spreads: spreadMap })
  } catch (error) {
    console.error('Error fetching spreads:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/charges - Get all charges with optional filters
router.get('/', async (req, res) => {
  try {
    const { segment, level, instrumentSymbol, userId } = req.query
    
    let query = { isActive: true }
    // Include charges for specific segment OR null segment (applies to all)
    if (segment) {
      query.$or = [{ segment: segment }, { segment: null }]
    }
    if (level) query.level = level
    if (instrumentSymbol) query.instrumentSymbol = instrumentSymbol
    if (userId) query.userId = userId

    const charges = await Charges.find(query)
      .populate('userId', 'name email mobile')
      .sort({ level: 1, createdAt: -1 })
    res.json({ success: true, charges })
  } catch (error) {
    console.error('Error fetching charges:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/charges/:id - Get single charge
router.get('/:id', async (req, res) => {
  try {
    const charge = await Charges.findById(req.params.id)
    if (!charge) {
      return res.status(404).json({ success: false, message: 'Charge not found' })
    }
    res.json({ success: true, charge })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/charges - Create new charge
router.post('/', async (req, res) => {
  try {
    const {
      level,
      userId,
      instrumentSymbol,
      segment,
      accountTypeId,
      spreadType,
      spreadValue,
      commissionType,
      commissionValue,
      commissionOnBuy,
      commissionOnSell,
      commissionOnClose,
      swapLong,
      swapShort,
      swapType
    } = req.body

    if (!level) {
      return res.status(400).json({ success: false, message: 'Level is required' })
    }

    const charge = await Charges.create({
      level,
      userId: userId || null,
      instrumentSymbol: instrumentSymbol || null,
      segment: segment || null,
      accountTypeId: accountTypeId || null,
      spreadType: spreadType || 'FIXED',
      spreadValue: spreadValue || 0,
      commissionType: commissionType || 'PER_LOT',
      commissionValue: commissionValue || 0,
      commissionOnBuy: commissionOnBuy !== false,
      commissionOnSell: commissionOnSell !== false,
      commissionOnClose: commissionOnClose || false,
      swapLong: swapLong || 0,
      swapShort: swapShort || 0,
      swapType: swapType || 'POINTS',
      isActive: true
    })

    // Sync spread to AccountType if this is an ACCOUNT_TYPE level charge
    if (level === 'ACCOUNT_TYPE' && accountTypeId && spreadValue > 0) {
      await AccountType.findByIdAndUpdate(accountTypeId, { 
        minSpread: spreadValue,
        commission: commissionValue || 0
      })
      console.log(`Synced spread ${spreadValue} and commission ${commissionValue || 0} to AccountType ${accountTypeId}`)
    }

    res.json({ success: true, message: 'Charge created', charge })
  } catch (error) {
    console.error('Error creating charge:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/charges/:id - Update charge
router.put('/:id', async (req, res) => {
  try {
    const {
      level,
      userId,
      instrumentSymbol,
      segment,
      accountTypeId,
      spreadType,
      spreadValue,
      commissionType,
      commissionValue,
      commissionOnBuy,
      commissionOnSell,
      commissionOnClose,
      swapLong,
      swapShort,
      swapType,
      isActive
    } = req.body

    const charge = await Charges.findById(req.params.id)
    if (!charge) {
      return res.status(404).json({ success: false, message: 'Charge not found' })
    }

    if (level !== undefined) charge.level = level
    if (userId !== undefined) charge.userId = userId || null
    if (instrumentSymbol !== undefined) charge.instrumentSymbol = instrumentSymbol || null
    if (segment !== undefined) charge.segment = segment || null
    if (accountTypeId !== undefined) charge.accountTypeId = accountTypeId || null
    if (spreadType !== undefined) charge.spreadType = spreadType
    if (spreadValue !== undefined) charge.spreadValue = spreadValue
    if (commissionType !== undefined) charge.commissionType = commissionType
    if (commissionValue !== undefined) charge.commissionValue = commissionValue
    if (commissionOnBuy !== undefined) charge.commissionOnBuy = commissionOnBuy
    if (commissionOnSell !== undefined) charge.commissionOnSell = commissionOnSell
    if (commissionOnClose !== undefined) charge.commissionOnClose = commissionOnClose
    if (swapLong !== undefined) charge.swapLong = swapLong
    if (swapShort !== undefined) charge.swapShort = swapShort
    if (swapType !== undefined) charge.swapType = swapType
    if (isActive !== undefined) charge.isActive = isActive

    await charge.save()

    // Sync spread to AccountType if this is an ACCOUNT_TYPE level charge
    if (charge.level === 'ACCOUNT_TYPE' && charge.accountTypeId) {
      const updateData = {}
      if (charge.spreadValue > 0) updateData.minSpread = charge.spreadValue
      if (charge.commissionValue > 0) updateData.commission = charge.commissionValue
      
      if (Object.keys(updateData).length > 0) {
        await AccountType.findByIdAndUpdate(charge.accountTypeId, updateData)
        console.log(`Synced spread/commission to AccountType ${charge.accountTypeId}:`, updateData)
      }
    }

    res.json({ success: true, message: 'Charge updated', charge })
  } catch (error) {
    console.error('Error updating charge:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// DELETE /api/charges/:id - Delete charge
router.delete('/:id', async (req, res) => {
  try {
    const charge = await Charges.findById(req.params.id)
    if (!charge) {
      return res.status(404).json({ success: false, message: 'Charge not found' })
    }

    await Charges.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Charge deleted' })
  } catch (error) {
    console.error('Error deleting charge:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
