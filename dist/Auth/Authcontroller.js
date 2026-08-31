import * as AuthService from './Authservice.js';
import { ok, badRequest, serverError } from '../utils/response.js';
import { LoginSchema, ChangePasswordSchema, ResetPasswordRequestSchema, ResetPasswordWithTokenSchema } from '../utils/validators.js';
import { writeAuditLog } from '../middleware/audit.middleware.js';
import { getClientIp } from '../utils/ip.js';
// ── POST /api/auth/login ──────────────────────────────────────────────
export const login = async (c) => {
    try {
        const body = await c.req.json();
        const parsed = LoginSchema.safeParse(body);
        if (!parsed.success)
            return badRequest(c, parsed.error.issues[0].message);
        const { email, password } = parsed.data;
        const result = await AuthService.signIn(email, password);
        const ip = getClientIp(c);
        writeAuditLog(result.user.id, 'login', `Login from ${email}`, ip);
        return ok(c, {
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
            expires_at: result.session.expires_at,
            user: result.user,
            must_change_password: result.mustChangePassword,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        return badRequest(c, message);
    }
};
// ── POST /api/auth/logout ─────────────────────────────────────────────
export const logout = async (c) => {
    try {
        const user = c.get('user');
        const token = c.get('token');
        await AuthService.signOut(token);
        const ip = getClientIp(c);
        writeAuditLog(user.id, 'logout', undefined, ip);
        return ok(c, { message: 'Logged out successfully' });
    }
    catch (err) {
        return serverError(c);
    }
};
// ── POST /api/auth/change-password ───────────────────────────────────
export const changePassword = async (c) => {
    try {
        const user = c.get('user');
        const token = c.get('token');
        const body = await c.req.json();
        const parsed = ChangePasswordSchema.safeParse(body);
        if (!parsed.success)
            return badRequest(c, parsed.error.issues[0].message);
        await AuthService.changePassword(user.id, token, parsed.data.new_password);
        const ip = getClientIp(c);
        writeAuditLog(user.id, 'password_change', 'User changed their password', ip);
        return ok(c, { message: 'Password changed successfully' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to change password';
        return serverError(c, message);
    }
};
// ── POST /api/auth/reset-password-request ─────────────────────────────
export const requestPasswordReset = async (c) => {
    try {
        const body = await c.req.json();
        const parsed = ResetPasswordRequestSchema.safeParse(body);
        if (!parsed.success)
            return badRequest(c, parsed.error.issues[0].message);
        const origin = c.req.header('origin') || c.req.header('referer');
        const result = await AuthService.requestPasswordReset(parsed.data.email, origin);
        const ip = getClientIp(c);
        if (result.profile?.id) {
            writeAuditLog(result.profile.id, 'user_password_reset', `Admin password reset requested for ${parsed.data.email}`, ip);
        }
        return ok(c, { message: result.message });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to request password reset';
        return badRequest(c, message);
    }
};
// ── POST /api/auth/reset-password ────────────────────────────────────
export const resetPasswordWithToken = async (c) => {
    try {
        const body = await c.req.json();
        const parsed = ResetPasswordWithTokenSchema.safeParse(body);
        if (!parsed.success)
            return badRequest(c, parsed.error.issues[0].message);
        const result = await AuthService.resetPasswordWithToken(parsed.data.access_token, parsed.data.new_password);
        return ok(c, { message: result.message });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reset password';
        return badRequest(c, message);
    }
};
// ── GET /api/auth/me ─────────────────────────────────────────────────
export const me = async (c) => {
    try {
        const user = c.get('user');
        const profile = await AuthService.getProfile(user.id);
        return ok(c, profile);
    }
    catch (err) {
        return serverError(c);
    }
};
