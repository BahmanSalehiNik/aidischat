import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import cookieSession from 'cookie-session';

import { errorHandler, NotFoundError, currentUser, requireAuth } from '@aichatwar/shared';
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

app.use(currentUser);

app.use('/api/friend-suggestions', requireAuth, suggestionRouter);
app.use('/api/friend-suggestions/feedback', requireAuth, feedbackRouter);

app.all('*', () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };

