import express from 'express'
import jwt from 'jsonwebtoken'
import { getPublicApiUrl, getPublicWebUrl, getSupportEmailFallback } from '../config/siteUrls.js'
import oxapayService from '../services/oxapayService.js'
import Transaction from '../models/Transaction.js'
import Wallet from '../models/Wallet.js'
import User from '../models/User.js'
import { sendTemplateEmail } from '../services/emailService.js'
import EmailSettings from '../models/EmailSettings.js'

const router = express.Router()

// GET /api/oxapay/currencies - Get supported crypto currencies
router.get('/currencies', async (req, res) => {
  try {
    // Default supported currencies (fallback)
    const defaultCurrencies = ['USDT', 'BTC', 'ETH', 'LTC', 'TRX', 'BNB', 'DOGE', 'SOL', 'XRP', 'ADA']
    
    const result = await oxapayService.getSupportedCurrencies()
    
    if (result.success && result.currencies) {
      res.json({ success: true, currencies: result.currencies })
    } else {
      // Return default currencies if API fails
      console.log('Using default currencies, API result:', result)
      res.json({ success: true, currencies: defaultCurrencies })
    }
  } catch (error) {
    console.error('Error getting currencies:', error)
    // Return default currencies on error
    res.json({ success: true, currencies: ['USDT', 'BTC', 'ETH', 'LTC', 'TRX', 'BNB'] })
  }
})

// POST /api/oxapay/create-payment - Create crypto deposit payment
router.post('/create-payment', async (req, res) => {
  try {
    const { userId, amount, currency } = req.body

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' })
    }

    // Check if OxaPay is configured
    if (!oxapayService.isConfigured()) {
      return res.status(500).json({ 
        success: false, 
        message: 'Crypto payments not configured. Please contact support.' 
      })
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 })
      await wallet.save()
    }

    // Generate unique order ID
    const orderId = `DEP-${userId.slice(-6)}-${Date.now()}`

    const baseUrl = getPublicApiUrl()
    const frontendUrl = getPublicWebUrl()

    console.log('Creating OxaPay payment:', { amount, currency, orderId })

    const paymentResult = await oxapayService.createPayment({
      amount: parseFloat(amount),
      currency: currency, // Optional - user can choose on payment page
      orderId: orderId,
      callbackUrl: `${baseUrl}/api/oxapay/webhook`,
      returnUrl: `${frontendUrl}/wallet?deposit=success`,
      description: `BULL4X Deposit - $${amount}`
    })

    console.log('OxaPay payment result:', paymentResult)

    if (!paymentResult.success) {
      console.error('OxaPay payment failed:', paymentResult)
      return res.status(400).json({ 
        success: false, 
        message: paymentResult.error || 'Failed to create payment',
        errorCode: paymentResult.errorCode
      })
    }

    // Create pending transaction
    const transaction = new Transaction({
      userId,
      walletId: wallet._id,
      type: 'Deposit',
      amount: parseFloat(amount),
      paymentMethod: `Crypto (${currency || 'USDT'})`,
      transactionRef: paymentResult.trackId,
      status: 'Pending',
      cryptoDetails: {
        trackId: paymentResult.trackId,
        address: paymentResult.address,
        currency: paymentResult.currency,
        network: paymentResult.network,
        payLink: paymentResult.payLink,
        expiredAt: paymentResult.expiredAt
      }
    })
    await transaction.save()

    // Update pending deposits
    wallet.pendingDeposits += parseFloat(amount)
    await wallet.save()

    res.json({
      success: true,
      payLink: paymentResult.payLink,
      trackId: paymentResult.trackId,
      address: paymentResult.address,
      amount: paymentResult.amount,
      currency: paymentResult.currency,
      network: paymentResult.network,
      expiredAt: paymentResult.expiredAt,
      transactionId: transaction._id
    })

  } catch (error) {
    console.error('Error creating crypto payment:', error)
    res.status(500).json({ success: false, message: 'Error creating payment' })
  }
})

// POST /api/oxapay/check-status - Check payment status
router.post('/check-status', async (req, res) => {
  try {
    const { trackId } = req.body

    if (!trackId) {
      return res.status(400).json({ success: false, message: 'Track ID required' })
    }

    const result = await oxapayService.checkPaymentStatus(trackId)

    if (result.success) {
      // Update transaction status if paid
      if (result.status === 'Paid') {
        const transaction = await Transaction.findOne({ 'cryptoDetails.trackId': trackId })
        if (transaction && transaction.status === 'Pending') {
          transaction.status = 'Approved'
          transaction.processedAt = new Date()
          if (result.txID) transaction.cryptoDetails.txID = result.txID
          await transaction.save()

          // Update wallet balance
          const wallet = await Wallet.findById(transaction.walletId)
          if (wallet) {
            wallet.balance += transaction.amount
            wallet.pendingDeposits = Math.max(0, wallet.pendingDeposits - transaction.amount)
            await wallet.save()
          }
          
          console.log(`Crypto deposit confirmed via status check: $${transaction.amount}`)
        }
      } else if (result.status === 'Expired' || result.status === 'Failed') {
        const transaction = await Transaction.findOne({ 'cryptoDetails.trackId': trackId })
        if (transaction && transaction.status === 'Pending') {
          transaction.status = 'Rejected'
          transaction.processedAt = new Date()
          await transaction.save()

          const wallet = await Wallet.findById(transaction.walletId)
          if (wallet) {
            wallet.pendingDeposits = Math.max(0, wallet.pendingDeposits - transaction.amount)
            await wallet.save()
          }
          
          console.log(`Crypto deposit ${result.status}: $${transaction.amount}`)
        }
      }

      res.json({
        success: true,
        status: result.status,
        amount: result.amount,
        currency: result.currency,
        txID: result.txID
      })
    } else {
      res.status(400).json({ success: false, message: result.error })
    }

  } catch (error) {
    console.error('Error checking payment status:', error)
    res.status(500).json({ success: false, message: 'Error checking status' })
  }
})

// POST /api/oxapay/webhook - OxaPay webhook for payment notifications
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body
    const hmacHeader = req.headers['hmac']

    console.log('OxaPay webhook received:', JSON.stringify(payload, null, 2))

    // Validate required fields
    if (!payload || !payload.trackId) {
      console.error('Invalid webhook payload - missing trackId')
      return res.status(400).json({ message: 'Invalid payload' })
    }

    const { trackId, status, amount, orderId, txID } = payload

    // Find transaction by trackId
    const transaction = await Transaction.findOne({ 'cryptoDetails.trackId': trackId })

    if (!transaction) {
      console.error('Transaction not found for trackId:', trackId)
      // Return 200 to prevent OxaPay from retrying for non-existent transactions
      return res.status(200).json({ message: 'Transaction not found, acknowledged' })
    }

    console.log(`Processing webhook for transaction ${transaction._id}, current status: ${transaction.status}, new status: ${status}`)

    // Only process if status changed to Paid and transaction is still Pending
    if (status === 'Paid' && transaction.status === 'Pending') {
      transaction.status = 'Approved'
      transaction.processedAt = new Date()
      if (txID) transaction.cryptoDetails.txID = txID
      await transaction.save()

      // Update wallet balance atomically to prevent race conditions
      const wallet = await Wallet.findById(transaction.walletId)
      if (wallet) {
        wallet.balance += transaction.amount
        wallet.pendingDeposits = Math.max(0, wallet.pendingDeposits - transaction.amount)
        await wallet.save()

        // Send success email
        try {
          const user = await User.findById(transaction.userId)
          if (user && user.email) {
            const settings = await EmailSettings.findOne()
            const appOrigin = getPublicWebUrl()
            await sendTemplateEmail('deposit_success', user.email, {
              firstName: user.firstName || user.email.split('@')[0],
              amount: transaction.amount.toFixed(2),
              transactionId: transaction._id.toString(),
              accountId: 'Main wallet',
              paymentMethod: transaction.paymentMethod,
              date: new Date().toLocaleString(),
              newBalance: wallet.balance.toFixed(2),
              dashboardUrl: `${appOrigin}/dashboard`,
              platformName: settings?.platformName || 'BULL4X',
              supportEmail: settings?.supportEmail || getSupportEmailFallback(),
              year: new Date().getFullYear().toString()
            })
          }
        } catch (emailError) {
          console.error('Error sending deposit email:', emailError)
        }
      }

      console.log(`Crypto deposit approved: $${transaction.amount} for user ${transaction.userId}`)
    } else if (status === 'Expired' || status === 'Failed') {
      transaction.status = 'Rejected'
      transaction.processedAt = new Date()
      await transaction.save()

      // Revert pending deposits
      const wallet = await Wallet.findById(transaction.walletId)
      if (wallet) {
        wallet.pendingDeposits -= transaction.amount
        await wallet.save()
      }

      console.log(`Crypto deposit ${status}: $${transaction.amount} for user ${transaction.userId}`)
    }

    // Always respond with 200 to acknowledge webhook
    res.status(200).json({ message: 'Webhook processed' })

  } catch (error) {
    console.error('Webhook processing error:', error)
    res.status(500).json({ message: 'Webhook error' })
  }
})

// POST /api/oxapay/create-withdrawal - Create crypto withdrawal (payout)
router.post('/create-withdrawal', async (req, res) => {
  try {
    const { userId, amount, walletAddress, currency, network, withdrawalToken } = req.body

    console.log('Withdrawal request received:', { userId, amount, walletAddress, currency, network })

    if (!withdrawalToken) {
      return res.status(401).json({
        success: false,
        message: 'Withdrawal verification required. Complete email OTP first.'
      })
    }

    try {
      const payload = jwt.verify(withdrawalToken, process.env.JWT_SECRET)
      if (payload.scope !== 'withdrawal' || String(payload.sub) !== String(userId)) {
        return res.status(401).json({ success: false, message: 'Invalid or expired withdrawal session' })
      }
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired withdrawal session' })
    }

    if (!userId || !amount || amount <= 0) {
      console.log('Invalid parameters:', { userId, amount })
      return res.status(400).json({ success: false, message: 'Invalid parameters' })
    }

    if (!walletAddress) {
      console.log('Wallet address missing')
      return res.status(400).json({ success: false, message: 'Wallet address is required' })
    }

    // Get wallet and check balance
    const wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      console.log('Wallet not found for userId:', userId)
      return res.status(404).json({ success: false, message: 'Wallet not found' })
    }

    console.log('Wallet found:', { balance: wallet.balance, pendingWithdrawals: wallet.pendingWithdrawals })

    if (wallet.balance < amount) {
      console.log('Insufficient balance:', { balance: wallet.balance, requested: amount })
      return res.status(400).json({ success: false, message: 'Insufficient balance' })
    }

    // Deduct from balance first
    wallet.balance -= parseFloat(amount)
    wallet.pendingWithdrawals += parseFloat(amount)
    await wallet.save()

    const baseUrl = getPublicApiUrl()

    console.log('Attempting OxaPay payout...')
    const payoutResult = await oxapayService.createPayout({
      address: walletAddress,
      amount: parseFloat(amount),
      currency: currency || 'USDT',
      network: network || 'TRC20',
      callbackUrl: `${baseUrl}/api/oxapay/payout-webhook`,
      description: `BULL4X Withdrawal - User ${userId}`
    })

    console.log('OxaPay payout result:', payoutResult)

    let transactionStatus = 'Pending'
    let trackId = null

    if (payoutResult.success) {
      transactionStatus = 'Processing'
      trackId = payoutResult.trackId
      console.log('OxaPay payout initiated successfully, trackId:', trackId)
    } else {
      console.log('OxaPay payout failed, will require manual processing:', payoutResult.error)
    }

    // Create transaction record
    const transaction = new Transaction({
      userId,
      walletId: wallet._id,
      type: 'Withdrawal',
      amount: parseFloat(amount),
      paymentMethod: `Crypto (${currency || 'USDT'})`,
      status: transactionStatus,
      cryptoDetails: {
        address: walletAddress,
        currency: currency || 'USDT',
        network: network || 'TRC20',
        trackId: trackId
      }
    })
    await transaction.save()

    // Send withdrawal email
    try {
      const user = await User.findById(userId)
      if (user && user.email) {
        const settings = await EmailSettings.findOne()
        await sendTemplateEmail('withdrawal_pending', user.email, {
          firstName: user.firstName || user.email.split('@')[0],
          amount: amount.toFixed(2),
          transactionId: transaction._id.toString(),
          paymentMethod: `Crypto (${currency || 'USDT'})`,
          walletAddress: walletAddress,
          date: new Date().toLocaleString(),
          platformName: settings?.platformName || 'BULL4X',
          supportEmail: settings?.supportEmail || getSupportEmailFallback(),
          year: new Date().getFullYear().toString()
        })
      }
    } catch (emailError) {
      console.error('Error sending withdrawal email:', emailError)
    }

    console.log('Withdrawal transaction created:', transaction._id)

    const message = payoutResult.success 
      ? 'Withdrawal submitted! Crypto will be sent to your wallet shortly.'
      : 'Withdrawal request submitted. It will be processed within 24 hours.'

    res.json({
      success: true,
      message: message,
      transactionId: transaction._id,
      autoProcessed: payoutResult.success
    })

  } catch (error) {
    console.error('Error creating crypto withdrawal:', error)
    console.error('Error details:', error.message, error.stack)
    res.status(500).json({ success: false, message: 'Error creating withdrawal: ' + error.message })
  }
})

// POST /api/oxapay/payout-webhook - OxaPay webhook for payout notifications
router.post('/payout-webhook', async (req, res) => {
  try {
    const payload = req.body
    console.log('OxaPay payout webhook received:', JSON.stringify(payload, null, 2))

    const { trackId, status, txID } = payload

    // Find transaction by trackId
    const transaction = await Transaction.findOne({ 'cryptoDetails.trackId': trackId })

    if (!transaction) {
      console.error('Payout transaction not found for trackId:', trackId)
      return res.status(200).json({ message: 'Transaction not found, acknowledged' })
    }

    if (status === 'Complete' && (transaction.status === 'Pending' || transaction.status === 'Processing')) {
      transaction.status = 'Approved'
      transaction.processedAt = new Date()
      if (txID) transaction.cryptoDetails.txID = txID
      await transaction.save()

      // Update wallet - remove from pending
      const wallet = await Wallet.findById(transaction.walletId)
      if (wallet) {
        wallet.pendingWithdrawals = Math.max(0, wallet.pendingWithdrawals - transaction.amount)
        await wallet.save()
      }

      // Send success email
      try {
        const user = await User.findById(transaction.userId)
        if (user && user.email) {
          const settings = await EmailSettings.findOne()
          await sendTemplateEmail('withdrawal_success', user.email, {
            firstName: user.firstName || user.email.split('@')[0],
            amount: transaction.amount.toFixed(2),
            transactionId: transaction._id.toString(),
            paymentMethod: transaction.paymentMethod,
            walletAddress: transaction.cryptoDetails?.address,
            txID: txID,
            date: new Date().toLocaleString(),
            platformName: settings?.platformName || 'BULL4X',
            supportEmail: settings?.supportEmail || getSupportEmailFallback(),
            year: new Date().getFullYear().toString()
          })
        }
      } catch (emailError) {
        console.error('Error sending withdrawal success email:', emailError)
      }

      console.log(`Crypto withdrawal completed: $${transaction.amount}`)
    } else if (status === 'Failed' || status === 'Rejected') {
      transaction.status = 'Rejected'
      transaction.processedAt = new Date()
      await transaction.save()

      // Refund to wallet
      const wallet = await Wallet.findById(transaction.walletId)
      if (wallet) {
        wallet.balance += transaction.amount
        wallet.pendingWithdrawals = Math.max(0, wallet.pendingWithdrawals - transaction.amount)
        await wallet.save()
      }

      console.log(`Crypto withdrawal failed: $${transaction.amount}`)
    }

    res.status(200).json({ message: 'Payout webhook processed' })

  } catch (error) {
    console.error('Payout webhook error:', error)
    res.status(500).json({ message: 'Webhook error' })
  }
})

export default router
