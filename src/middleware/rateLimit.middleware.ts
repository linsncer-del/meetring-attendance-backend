import { rateLimiter } from 'hono-rate-limiter'
import { getClientIp } from '../utils/ip.js'

/**
 * Strict rate limiter for the public attendance submission endpoint.
 * Allows 10 submissions per 5-minute window per IP.
 */
export const attendanceRateLimit = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 10,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => getClientIp(c) ?? 'unknown',
  message: {
    success: false,
    error: 'Too many submissions from this IP. Please try again in a few minutes.',
  },
})

/**
 * General API rate limiter — 100 requests per minute per IP.
 */
export const generalRateLimit = rateLimiter({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => getClientIp(c) ?? 'unknown',
  message: { success: false, error: 'Too many requests. Slow down.' },
})

