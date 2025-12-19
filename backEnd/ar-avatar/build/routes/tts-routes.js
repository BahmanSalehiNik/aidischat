"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ttsRouter = void 0;
const express_1 = __importDefault(require("express"));
const tts_service_1 = require("../services/tts-service");
const router = express_1.default.Router();
exports.ttsRouter = router;
/**
 * POST /api/tts/generate
 * Generate TTS audio and visemes from text
 */
router.post('/generate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { text, voiceId, emotion, language } = req.body;
    if (!text || !voiceId) {
        return res.status(400).json({ error: 'text and voiceId are required' });
    }
    try {
        const result = yield tts_service_1.ttsService.generateTTS(text, voiceId, emotion, language || 'en');
        res.json(result);
    }
    catch (error) {
        console.error('[TTSRoutes] Error generating TTS:', error);
        res.status(500).json({ error: error.message || 'Failed to generate TTS' });
    }
}));
