import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import cookieSession from 'cookie-session';

import { errorHandler, NotFoundError, extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { suggestionRouter } from './routes/suggestions';
import { feedbackRouter } from './routes/feedback';

const app = express();
app.set('trust proxy', true);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  cookieSession({
    signed: false,
    secure: false,
  })
);

app.use(extractJWTPayload);

app.use('/api/friend-suggestions', loginRequired, suggestionRouter);
app.use('/api/friend-suggestions/feedback', loginRequired, feedbackRouter);

app.all('*', () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };

