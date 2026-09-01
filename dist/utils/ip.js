/**
 * Extracts a clean, single client IP address from request headers.
 * Safely parses comma-separated proxy chains (e.g., from Render / Cloudflare: "ClientIP, Proxy1, Proxy2")
 * to prevent PostgreSQL INET column format errors.
 */
export const getClientIp = (c) => {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
        const firstIp = forwarded.split(',')[0].trim();
        if (firstIp)
            return firstIp;
    }
    const realIp = c.req.header('x-real-ip');
    if (realIp) {
        const firstIp = realIp.split(',')[0].trim();
        if (firstIp)
            return firstIp;
    }
    const cfConnectingIp = c.req.header('cf-connecting-ip');
    if (cfConnectingIp) {
        const firstIp = cfConnectingIp.split(',')[0].trim();
        if (firstIp)
            return firstIp;
    }
    return undefined;
};
/**
 * Sanitizes any raw IP string to a single IP address safe for PostgreSQL INET data type.
 */
export const sanitizeIp = (rawIp) => {
    if (!rawIp)
        return null;
    const cleaned = rawIp.split(',')[0].trim();
    return cleaned || null;
};
