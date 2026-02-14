import cors from 'cors';
import express, { type Request, type Response } from 'express';
import 'express-async-errors';
import cookieSession from 'cookie-session';
import { errorHandler, NotFoundError } from '@aichatwar/shared';
import { usageRouter } from './routes/usage';
import { alertsRouter } from './routes/alerts';

const app = express();
app.set('trust proxy', true);
app.use(express.json());

// Support both web (cookie session) and mobile (Authorization Bearer token).
app.use(
  cookieSession({
    signed: false,
    secure: false,
    sameSite: 'lax',
  })
);

app.use(
  cors({
    credentials: true,
    origin: true,
  })
);

app.get(['/api/ai-gateway/healthz', '/api/ai-gateway/livez'], (_req: Request, res: Response) => {
  res.status(200).send({
    status: 'ok',
    service: 'ai-gateway',
    timestamp: new Date().toISOString(),
  });
});

app.use(usageRouter);
app.use(alertsRouter);

app.all('*', async () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };


