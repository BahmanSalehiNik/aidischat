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
exports.retryWithBackoff = retryWithBackoff;
const promises_1 = require("timers/promises");
const DEFAULT_RETRY_OPTIONS = {
    maxRetries: 30,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    multiplier: 2,
    retryable: () => true,
};
function retryWithBackoff(fn_1) {
    return __awaiter(this, arguments, void 0, function* (fn, options = {}, context = 'Connection') {
        const mergedOptions = Object.assign(Object.assign({}, DEFAULT_RETRY_OPTIONS), options);
        let currentDelay = mergedOptions.initialDelayMs;
        for (let i = 0; i < mergedOptions.maxRetries; i++) {
            try {
                return yield fn();
            }
            catch (error) {
                if (!mergedOptions.retryable(error)) {
                    console.error(`❌ [${context}] Non-retryable error:`, error.message || error);
                    throw error;
                }
                console.warn(`⚠️ [${context}] Attempt ${i + 1}/${mergedOptions.maxRetries} failed:`, error.message || error);
                if (i < mergedOptions.maxRetries - 1) {
                    console.log(`[${context}] Retrying in ${currentDelay / 1000} seconds...`);
                    yield (0, promises_1.setTimeout)(currentDelay);
                    currentDelay = Math.min(currentDelay * mergedOptions.multiplier, mergedOptions.maxDelayMs);
                }
                else {
                    console.error(`❌ [${context}] Max retries (${mergedOptions.maxRetries}) exceeded.`);
                    throw error;
                }
            }
        }
        throw new Error(`[${context}] Failed after ${mergedOptions.maxRetries} retries.`);
    });
}
