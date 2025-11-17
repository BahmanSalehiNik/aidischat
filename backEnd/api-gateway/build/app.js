"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const morgan_1 = __importDefault(require("morgan"));
const routes_1 = require("./config/routes");
const proxyTimeout = Number(process.env.PROXY_TIMEOUT_MS || 30000);
const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowAllOrigins = corsOrigins.length === 0 || corsOrigins.includes('*');
const buildProxy = (target) => (0, http_proxy_middleware_1.createProxyMiddleware)({
    target,
    changeOrigin: true,
    ws: true,
    proxyTimeout,
    timeout: proxyTimeout,
    on: {
        proxyReq: (proxyReq, incomingReq) => {
            const req = incomingReq;
            const forwardedHost = req.get?.('host') || req.headers.host || '';
            const forwardedProto = req.get?.('x-forwarded-proto') ||
                req.protocol ||
                (req.secure ? 'https' : 'http');
            if (!proxyReq.getHeader('x-forwarded-host') && forwardedHost) {
                proxyReq.setHeader('x-forwarded-host', forwardedHost);
            }
            if (!proxyReq.getHeader('x-forwarded-proto') && forwardedProto) {
                proxyReq.setHeader('x-forwarded-proto', forwardedProto);
            }
        },
        error: (err, incomingReq, incomingRes) => {
            const req = incomingReq;
            const res = incomingRes;
            if (res.headersSent) {
                return;
            }
            res.status(502).send({
                errors: [
                    {
                        message: `Upstream service unavailable for ${req.method} ${req.originalUrl}`,
                        detail: err.message,
                    },
                ],
            });
        },
    },
});
const proxyCache = new Map();
const findRoute = (path) => routes_1.routeRules.find((rule) => rule.patterns.some((pattern) => pattern.test(path)));
const getProxy = (target) => {
    if (!proxyCache.has(target)) {
        proxyCache.set(target, buildProxy(target));
    }
    return proxyCache.get(target);
};
const resolveTarget = (path) => {
    const matchedRule = findRoute(path);
    if (!matchedRule) {
        return null;
    }
    const target = process.env[matchedRule.targetEnv];
    if (!target) {
        return null;
    }
    return { target, matchedRule };
};
const app = (0, express_1.default)();
exports.app = app;
app.set('trust proxy', true);
app.use((0, cors_1.default)({
    credentials: true,
    origin: allowAllOrigins ? true : corsOrigins,
}));
app.use((0, compression_1.default)());
if (process.env.NODE_ENV !== 'production') {
    app.use((0, morgan_1.default)('dev'));
}
app.get(['/api-gateway/healthz', '/api-gateway/livez'], (req, res) => {
    res.status(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});
app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
        return next();
    }
    const resolved = resolveTarget(req.path);
    if (!resolved) {
        return res.status(502).send({
            errors: [
                {
                    message: `No upstream service configured for ${req.method} ${req.originalUrl}`,
                },
            ],
        });
    }
    return getProxy(resolved.target)(req, res, next);
});
app.all('*', (req, res) => {
    res.status(404).send({
        errors: [
            {
                message: 'Not Found',
            },
        ],
    });
});
//# sourceMappingURL=app.js.map