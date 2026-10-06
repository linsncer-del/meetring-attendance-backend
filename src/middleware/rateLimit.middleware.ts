import { rateLimiter } from 'hono-rate-limiter'
import { getClientIp } from '../utils/ip.js'

// Limits are per IP address. A meeting room usually shares one public IP (the
// office or venue Wi-Fi), so they are sized for a full room signing in at
// once, not for one person.

/**
 * Meeting PIN checks. High enough for a full room on one network, low enough
 * that guessing a 6-digit PIN (1,000,000 combinations) would take weeks.
 */
export const pinRateLimit = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 200,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => getClientIp(c) ?? 'unknown',
  message: {
    success: false,
    error: 'Too many PIN attempts from this network. Please wait a few minutes and try again.',
  },
})

/**
 * Public attendance submissions — 300 per 5 minutes per IP.
 */
export const attendanceRateLimit = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 300,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => getClientIp(c) ?? 'unknown',
  message: {
    success: false,
    error: 'Too many sign-ins from this network right now. Please wait a minute and try again.',
  },
})

/**
 * General API rate limiter — 600 requests per minute per IP. Every phone on
 * the sign-in page polls the meeting status, and organisers' dashboards poll
 * too, so a shared office or venue IP needs headroom.
 */
export const generalRateLimit = rateLimiter({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => getClientIp(c) ?? 'unknown',
  message: { success: false, error: 'Too many requests. Slow down.' },
})

