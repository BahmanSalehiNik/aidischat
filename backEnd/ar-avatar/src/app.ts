import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";
import { errorHandler, NotFoundError } from "@aichatwar/shared";
import cors from "cors";

const app = express();
app.set('trust proxy', true);
app.use(json());




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

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        service: 'ar-avatar',
        timestamp: new Date().toISOString()
    });
});

// Routes will be added in index.ts
// Note: Catch-all route and error handler are added in index.ts after routes

export { app };

