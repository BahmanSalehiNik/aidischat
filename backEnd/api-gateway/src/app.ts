import compression from 'compression';
import cors from 'cors';
import express, { Request, Response } from 'express';
import { createProxyMiddleware, RequestHandler as ProxyHandler } from 'http-proxy-middleware';
import { ClientRequest } from 'http';
import morgan from 'morgan';
import { routeRules } from './config/routes';

const proxyTimeout = Number(process.env.PROXY_TIMEOUT_MS || 30000);

const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowAllOrigins = corsOrigins.length === 0 || corsOrigins.includes('*');

const buildProxy = (target: string): ProxyHandler<Request, Response> =>
  createProxyMiddleware<Request, Response>({
    target,
    changeOrigin: true,
    ws: true,
    proxyTimeout,
    timeout: proxyTimeout,
    on: {
      proxyReq: (proxyReq: ClientRequest, incomingReq) => {
        const req = incomingReq as Request;
        const forwardedHost = req.get?.('host') || req.headers.host || '';
        const forwardedProto =
          req.get?.('x-forwarded-proto') ||
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
        const req = incomingReq as Request;
        const res = incomingRes as Response;

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

const proxyCache = new Map<string, ProxyHandler<Request, Response>>();

const findRoute = (path: string) =>
  routeRules.find((rule) => rule.patterns.some((pattern) => pattern.test(path)));

const getProxy = (target: string) => {
  if (!proxyCache.has(target)) {
    proxyCache.set(target, buildProxy(target));
  }
  return proxyCache.get(target)!;
};

const resolveTarget = (path: string) => {
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

const app = express();
app.set('trust proxy', true);

app.use(
  cors({
    credentials: true,
    origin: allowAllOrigins ? true : corsOrigins,
  })
);

app.use(compression());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
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

export { app };

