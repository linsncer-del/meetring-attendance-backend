import * as UsersService from './users.service.js';
import { ok, created, badRequest, notFound, serverError, paginated, } from '../utils/response.js';
import { CreateUserSchema, UpdateUserSchema, PaginationSchema } from '../utils/validators.js';
import { writeAuditLog } from '../middleware/audit.middleware.js';
import { getClientIp } from '../utils/ip.js';
// GET /api/users
export const list = async (c) => {
    try {
        const { page, limit } = PaginationSchema.parse({
            page: c.req.query('page'),
            limit: c.req.query('limit'),
        });
        const { users, total } = await UsersService.listUsers(page, limit);
        return paginated(c, users, total, page, limit);
    }
    catch {
        return serverError(c);
    }
};
// GET /api/users/:id
export const getOne = async (c) => {
    try {
        const user = await UsersService.getUserById(c.req.param('id') || '');
        return ok(c, user);
    }
    catch {
        return notFound(c);
    }
};
// POST /api/users
export const create = async (c) => {
    try {
        const body = await c.req.json();
        const parsed = CreateUserSchema.safeParse(body);
        if (!parsed.success)
            return badRequest(c, parsed.error.issues[0].message);
        const newUser = await UsersService.createUser(parsed.data);
        const actor = c.get('user');
        const ip = getClientIp(c);
        writeAuditLog(actor.id, 'user_created', `Created user: ${parsed.data.email}`, ip);
        return created(c, newUser);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create user';
        return badRequest(c, message);
    }
};
// PATCH /api/users/:id
export const update = async (c) => {
    try {
        const body = await c.req.json();
        const parsed = UpdateUserSchema.safeParse(body);
        if (!parsed.success)
            return badRequest(c, parsed.error.issues[0].message);
        const user = await UsersService.updateUser(c.req.param('id') || '', parsed.data);
        return ok(c, user);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Update failed';
        return badRequest(c, message);
    }
};
// PATCH /api/users/:id/disable
export const disable = async (c) => {
    try {
        await UsersService.setUserActive(c.req.param('id') || '', false);
        const actor = c.get('user');
        const ip = getClientIp(c);
        writeAuditLog(actor.id, 'user_disabled', `Disabled user: ${c.req.param('id') || ''}`, ip);
        return ok(c, { message: 'User account disabled' });
    }
    catch (err) {
        return serverError(c);
    }
};
// PATCH /api/users/:id/enable
export const enable = async (c) => {
    try {
        await UsersService.setUserActive(c.req.param('id') || '', true);
        return ok(c, { message: 'User account enabled' });
    }
    catch {
        return serverError(c);
    }
};
// POST /api/users/:id/reset-password
export const resetPassword = async (c) => {
    try {
        let temp_password = 'Admin@2056';
        try {
            const body = await c.req.json();
            if (body?.temp_password)
                temp_password = body.temp_password;
        }
        catch {
            // Body missing or empty, default to Admin@2056
        }
        if (temp_password.length < 8) {
            return badRequest(c, 'Temporary password must be at least 8 characters');
        }
        await UsersService.adminResetPassword(c.req.param('id') || '', temp_password);
        const actor = c.get('user');
        const ip = getClientIp(c);
        writeAuditLog(actor.id, 'user_password_reset', `Password reset for: ${c.req.param('id') || ''}`, ip);
        return ok(c, { message: `Password reset to default (${temp_password}). A notification has been sent to the user.` });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Reset failed';
        return serverError(c, message);
    }
};
