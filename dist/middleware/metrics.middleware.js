import { Registry, collectDefaultMetrics, Histogram, Counter } from 'prom-client';
// ── Registry ──────────────────────────────────────────────────────────
// Single shared registry for the whole app. Exposed at GET /metrics
// in index.ts for Prometheus to scrape.
export const registry = new Registry();
// Node.js process metrics: CPU, memory, event loop lag, GC, etc.
collectDefaultMetrics({ register: registry });
// ── Custom metrics ────────────────────────────────────────────────────
export const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
});
export const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
});
export const httpRequestErrorsTotal = new Counter({
    name: 'http_request_errors_total',
    help: 'Total number of HTTP requests that resulted in a 4xx or 5xx response',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
});
// ── Middleware ────────────────────────────────────────────────────────
// Wraps every request, records duration + counts, labeled by the
// matched route pattern (not raw path, to avoid unbounded label
// cardinality from dynamic segments like IDs).
export const metricsMiddleware = async (c, next) => {
    // Skip instrumenting the metrics endpoint itself
    if (c.req.path === '/metrics') {
        await next();
        return;
    }
    const start = process.hrtime.bigint();
    await next();
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const method = c.req.method;
    const route = c.req.routePath ?? c.req.path;
    const statusCode = String(c.res.status);
    httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    if (c.res.status >= 400) {
        httpRequestErrorsTotal.inc({ method, route, status_code: statusCode });
    }
};
