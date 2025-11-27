import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";
import cors from "cors";
import { errorHandler, NotFoundError, extractJWTPayload } from "@aichatwar/shared";

/**
 * Agent Learning service (RLHF) Express bootstrap.
 * Provides health endpoints (future) and reuses shared middlewares
 * for consistency across services. Primary responsibilities live
 * in Kafka listeners—not HTTP routes.
 */
const app = express();
app.set("trust proxy", true);
app.use(json());
app.use(cookieSession({
    signed: false,
    secure: false,
    sameSite: "lax"
}));

app.use(extractJWTPayload);

app.use(cors({
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

app.all("*", async () => {
    throw new NotFoundError();
});

app.use(errorHandler);

export { app };

