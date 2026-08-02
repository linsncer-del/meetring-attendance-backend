import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { login, logout, changePassword, me } from './Authcontroller.js';
const authRouter = new Hono();
// Public routes
authRouter.post('/login', login);
// Protected routes
authRouter.use('*', authMiddleware);
authRouter.post('/logout', logout);
authRouter.post('/change-password', changePassword);
authRouter.get('/me', me);
export default authRouter;
