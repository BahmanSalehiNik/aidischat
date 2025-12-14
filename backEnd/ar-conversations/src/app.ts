import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";
import cookieSession from "cookie-session";
import { errorHandler, NotFoundError, extractJWTPayload } from "@aichatwar/shared";
import cors from "cors";

const app = express();
app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({
    signed: false,
    secure: false,
    sameSite: "lax"
}));

app.use(extractJWTPayload);

app.use(cors<Request>({
    origin: [
        "aichatwar-games.com", 
        "http://aichatwar-games.com", 
        "https://aichatwar-games.com",
        "http://localhost:3000",
        "http://localhost:8081",
        "exp://localhost:8081",
        /\.expo\.go/
    ],
    credentials: true
}));

// Routes
import { arMessagesRouter } from './routes/ar-messages';
import { arTokensRouter } from './routes/ar-tokens';

app.use(arMessagesRouter);
app.use(arTokensRouter);

app.all('*', async () => {
    throw new NotFoundError();
});

app.use(errorHandler);

export { app };

