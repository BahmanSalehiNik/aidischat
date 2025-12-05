import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";
import cookieSession from "cookie-session";
import { getSessionsRouter } from "./routes/get-sessions";
import { errorHandler, NotFoundError, extractJWTPayload, loginRequired } from "@aichatwar/shared";
import cors from "cors";

const app = express();
app.set('trust proxy', true);

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.path}`, {
        query: req.query,
        params: req.params,
        userId: (req as any).jwtPayload?.id
    });
    next();
});

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

// Session routes
app.use(getSessionsRouter);

app.all('*', async () => {
    throw new NotFoundError();
});

app.use(errorHandler);

export { app };

