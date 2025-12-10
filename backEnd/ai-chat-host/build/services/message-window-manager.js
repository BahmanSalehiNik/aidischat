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
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageWindowManager = exports.MessageWindowManager = void 0;
const message_window_1 = require("../models/message-window");
const constants_1 = require("../config/constants");
class MessageWindowManager {
    /**
     * Add a message to the window for a room
     * Maintains sliding window of last N messages (FIFO)
     */
    addMessage(roomId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get or create window
            let window = yield message_window_1.MessageWindowModel.get(roomId);
            if (!window) {
                window = message_window_1.MessageWindowModel.create(roomId);
            }
            // Convert createdAt to Date if string
            const createdAt = typeof message.createdAt === 'string'
                ? new Date(message.createdAt)
                : message.createdAt;
            // Create window message
            const windowMessage = {
                id: message.id,
                content: message.content,
                senderId: message.senderId,
                senderType: message.senderType,
                createdAt,
            };
            // Add message to window (FIFO - remove oldest if exceeds size)
            window.messages.push(windowMessage);
            // Maintain sliding window size
            if (window.messages.length > constants_1.ANALYSIS_CONFIG.WINDOW_SIZE) {
                window.messages.shift(); // Remove oldest message
            }
            // Update timestamps
            window.lastMessageAt = createdAt;
            // Save window
            yield message_window_1.MessageWindowModel.save(window);
            console.log(`[MessageWindowManager] Added message to window for room ${roomId}, window size: ${window.messages.length}`);
            return window;
        });
    }
    /**
     * Get current window for a room
     */
    getWindow(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield message_window_1.MessageWindowModel.get(roomId);
        });
    }
    /**
     * Clear window for a room
     */
    clearWindow(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield message_window_1.MessageWindowModel.clear(roomId);
            console.log(`[MessageWindowManager] Cleared window for room ${roomId}`);
        });
    }
    /**
     * Get only human messages from window (for analysis)
     */
    getHumanMessages(window) {
        return window.messages.filter(m => m.senderType === 'human');
    }
    /**
     * Get combined text from all messages in window
     */
    getCombinedText(window) {
        return window.messages
            .map(m => m.content)
            .filter(content => content && content.trim().length > 0)
            .join(' ');
    }
}
exports.MessageWindowManager = MessageWindowManager;
exports.messageWindowManager = new MessageWindowManager();
