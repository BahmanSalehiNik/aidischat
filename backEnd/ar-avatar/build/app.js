"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
require("express-async-errors");
const body_parser_1 = require("body-parser");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
exports.app = app;
app.set('trust proxy', true);
app.use((0, body_parser_1.json)());
app.use((0, cors_1.default)({
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
