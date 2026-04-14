function stripTrailingSlash(s) {
  if (!s || typeof s !== 'string') return s
  return s.replace(/\/+$/, '')
}

/** Public web origin for emails, redirects, and OxaPay returnUrl (set PUBLIC_WEB_URL when deployed). */
export function getPublicWebUrl() {
  return stripTrailingSlash(
    process.env.PUBLIC_WEB_URL ||
      process.env.CORS_ORIGIN ||
      'http://localhost:5173'
  )
}

/** Public API base URL for payment webhooks (set PUBLIC_API_URL when the API is on another host). */
export function getPublicApiUrl() {
  const port = process.env.PORT || 5000
  return stripTrailingSlash(process.env.PUBLIC_API_URL || `http://127.0.0.1:${port}`)
}

export function getSupportEmailFallback() {
  return process.env.SUPPORT_EMAIL || 'support@example.com'
}
