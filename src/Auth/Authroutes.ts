import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { login, logout, changePassword, me, requestPasswordReset, resetPasswordWithToken } from './Authcontroller.js'
import type { HonoVariables } from '../types/index.js'

const authRouter = new Hono<{ Variables: HonoVariables }>()

// Public routes
authRouter.post('/login', login)
authRouter.post('/reset-password-request', requestPasswordReset)
authRouter.post('/reset-password', resetPasswordWithToken)

// Protected routes
authRouter.use('*', authMiddleware)
authRouter.post('/logout', logout)
authRouter.post('/change-password', changePassword)
authRouter.get('/me', me)


export default authRouter
