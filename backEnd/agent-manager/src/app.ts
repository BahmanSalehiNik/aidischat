import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";
import cookieSession from "cookie-session";
import cors from "cors";

import { errorHandler, NotFoundError, extractJWTPayload } from "@aichatwar/shared";

// Import routes
import { draftsRouter } from "./routes/drafts";
import { presenceRouter } from "./routes/presence";
import { safetyRouter } from "./routes/safety";

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
    origin: ["aichatwar-games.com", "http://aichatwar-games.com", "https://aichatwar-games.com"],
    credentials: true
}));

// Routes
app.use(draftsRouter);
app.use(presenceRouter);
app.use(safetyRouter);

app.all('*', async () => {
    throw new NotFoundError();
});

app.use(errorHandler);

export { app };

