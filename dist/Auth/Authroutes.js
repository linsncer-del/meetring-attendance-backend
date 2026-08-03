import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { login, logout, changePassword, me, requestPasswordReset, resetPasswordWithToken } from './Authcontroller.js';
const authRouter = new Hono();
// Public routes
authRouter.post('/login', login);
authRouter.post('/reset-password-request', requestPasswordReset);
authRouter.post('/reset-password', resetPasswordWithToken);
// Protected routes
authRouter.use('*', authMiddleware);
authRouter.post('/logout', logout);
authRouter.post('/change-password', changePassword);
authRouter.get('/me', me);
export default authRouter;
