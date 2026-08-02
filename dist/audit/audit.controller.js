import * as AuditService from './audit.service.js';
import { ok, serverError, paginated } from '../utils/response.js';
// GET /api/audit
export const list = async (c) => {
    try {
        const page = Number(c.req.query('page') ?? 1);
        const limit = Number(c.req.query('limit') ?? 50);
        const filters = {
            userId: c.req.query('user_id'),
            action: c.req.query('action'),
            from: c.req.query('from'),
            to: c.req.query('to'),
        };
        const { logs, total } = await AuditService.listAuditLogs(page, limit, filters);
        return paginated(c, logs, total, page, limit);
    }
    catch {
        return serverError(c);
    }
};
