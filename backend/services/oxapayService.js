import fetch from 'node-fetch'

const OXAPAY_API_URL = 'https://api.oxapay.com'

class OxaPayService {
  constructor() {
    // Keys will be read dynamically from env on each request
  }

  getMerchantKey() {
    return process.env.OXAPAY_MERCHANT_API_KEY
  }

  getPayoutKey() {
    return process.env.OXAPAY_PAYOUT_API_KEY
  }

  isConfigured() {
    const key = this.getMerchantKey()
    if (!key) {
      console.warn('WARNING: OXAPAY_MERCHANT_API_KEY not set. Value:', key)
    }
    return !!key
  }

  /**
   * Create a crypto payment invoice
   * @param {Object} params - Payment parameters
   * @param {number} params.amount - Amount in USD
   * @param {string} params.currency - Crypto currency (BTC, ETH, USDT, etc.)
   * @param {string} params.orderId - Unique order ID
   * @param {string} params.callbackUrl - Webhook URL for payment status updates
   * @param {string} params.returnUrl - URL to redirect after payment
   * @param {string} params.description - Payment description
   * @returns {Promise<Object>} - Payment invoice details
   */
  async createPayment(params) {
    const { amount, currency, orderId, callbackUrl, returnUrl, description } = params

    const payload = {
      merchant: this.getMerchantKey(),
      amount: parseFloat(amount),
      lifeTime: 60, // 60 minutes
      feePaidByPayer: 0, // 0 = merchant pays fee, 1 = payer pays fee
      underPaidCover: 2.5, // Accept payments up to 2.5% less
      callbackUrl: callbackUrl,
      returnUrl: returnUrl,
      description: description || `Deposit - Order #${orderId}`,
      orderId: orderId
    }

    // Only add currency if specified (optional - user can choose on payment page)
    if (currency) {
      payload.currency = currency
    }

    try {
      const response = await fetch(`${OXAPAY_API_URL}/merchants/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.result === 100) {
        return {
          success: true,
          trackId: data.trackId,
          payLink: data.payLink,
          address: data.address,
          amount: data.amount,
          currency: data.currency,
          network: data.network,
          expiredAt: data.expiredAt
        }
      } else {
        console.error('OxaPay create payment error:', data)
        return {
          success: false,
          error: data.message || 'Failed to create payment',
          errorCode: data.result
        }
      }
    } catch (error) {
      console.error('OxaPay API error:', error)
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }

  /**
   * Check payment status
   * @param {string} trackId - OxaPay track ID
   * @returns {Promise<Object>} - Payment status
   */
  async checkPaymentStatus(trackId) {
    const payload = {
      merchant: this.getMerchantKey(),
      trackId: trackId
    }

    try {
      const response = await fetch(`${OXAPAY_API_URL}/merchants/inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.result === 100) {
        return {
          success: true,
          status: data.status, // Waiting, Confirming, Paid, Failed, Expired
          amount: data.amount,
          currency: data.currency,
          payAmount: data.payAmount,
          payCurrency: data.payCurrency,
          txID: data.txID,
          orderId: data.orderId
        }
      } else {
        return {
          success: false,
          error: data.message || 'Failed to check payment status'
        }
      }
    } catch (error) {
      console.error('OxaPay status check error:', error)
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }

  /**
   * Get supported currencies
   * @returns {Promise<Object>} - List of supported currencies
   */
  async getSupportedCurrencies() {
    try {
      const response = await fetch(`${OXAPAY_API_URL}/merchants/allowedCoins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchant: this.getMerchantKey()
        })
      })

      const data = await response.json()

      if (data.result === 100) {
        return {
          success: true,
          currencies: data.allowed
        }
      } else {
        return {
          success: false,
          error: data.message || 'Failed to get currencies'
        }
      }
    } catch (error) {
      console.error('OxaPay get currencies error:', error)
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }

  /**
   * Create a static wallet address for deposits
   * @param {Object} params - Wallet parameters
   * @param {string} params.currency - Crypto currency
   * @param {string} params.network - Network (e.g., TRC20, ERC20)
   * @param {string} params.callbackUrl - Webhook URL
   * @returns {Promise<Object>} - Static wallet address
   */
  async createStaticAddress(params) {
    const { currency, network, callbackUrl } = params

    const payload = {
      merchant: this.getMerchantKey(),
      currency: currency,
      network: network,
      callbackUrl: callbackUrl
    }

    try {
      const response = await fetch(`${OXAPAY_API_URL}/merchants/request/staticaddress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.result === 100) {
        return {
          success: true,
          address: data.address,
          currency: data.currency,
          network: data.network
        }
      } else {
        return {
          success: false,
          error: data.message || 'Failed to create static address'
        }
      }
    } catch (error) {
      console.error('OxaPay static address error:', error)
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }

  /**
   * Verify webhook signature
   * @param {Object} payload - Webhook payload
   * @param {string} hmacHeader - HMAC signature from header
   * @returns {boolean} - Is valid signature
   */
  verifyWebhook(payload, hmacHeader) {
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha512', this.getMerchantKey())
    hmac.update(JSON.stringify(payload))
    const calculatedHmac = hmac.digest('hex')
    return calculatedHmac === hmacHeader
  }

  /**
   * Create a crypto payout (withdrawal)
   * @param {Object} params - Payout parameters
   * @param {string} params.address - Recipient wallet address
   * @param {number} params.amount - Amount in USD
   * @param {string} params.currency - Crypto currency (USDT, BTC, etc.)
   * @param {string} params.network - Network (TRC20, ERC20, etc.)
   * @param {string} params.callbackUrl - Webhook URL for payout status
   * @param {string} params.description - Payout description
   * @returns {Promise<Object>} - Payout result
   */
  async createPayout(params) {
    const { address, amount, currency, network, callbackUrl, description } = params

    const payoutKey = this.getPayoutKey()
    if (!payoutKey) {
      return {
        success: false,
        error: 'Payout API key not configured'
      }
    }

    const payload = {
      key: payoutKey,
      address: address,
      amount: parseFloat(amount),
      currency: currency || 'USDT',
      network: network || 'TRC20',
      callbackUrl: callbackUrl,
      description: description || 'Withdrawal'
    }

    try {
      const response = await fetch(`${OXAPAY_API_URL}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.result === 100) {
        return {
          success: true,
          trackId: data.trackId,
          status: data.status,
          amount: data.amount,
          currency: data.currency,
          network: data.network,
          address: data.address,
          txID: data.txID
        }
      } else {
        console.error('OxaPay payout error:', data)
        return {
          success: false,
          error: data.message || 'Failed to create payout',
          errorCode: data.result
        }
      }
    } catch (error) {
      console.error('OxaPay payout API error:', error)
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }

  /**
   * Check payout status
   * @param {string} trackId - Payout track ID
   * @returns {Promise<Object>} - Payout status
   */
  async checkPayoutStatus(trackId) {
    const payoutKey = this.getPayoutKey()
    if (!payoutKey) {
      return {
        success: false,
        error: 'Payout API key not configured'
      }
    }

    const payload = {
      key: payoutKey,
      trackId: trackId
    }

    try {
      const response = await fetch(`${OXAPAY_API_URL}/api/inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.result === 100) {
        return {
          success: true,
          status: data.status,
          amount: data.amount,
          currency: data.currency,
          network: data.network,
          address: data.address,
          txID: data.txID
        }
      } else {
        return {
          success: false,
          error: data.message || 'Failed to check payout status'
        }
      }
    } catch (error) {
      console.error('OxaPay payout status error:', error)
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

export default new OxaPayService()
