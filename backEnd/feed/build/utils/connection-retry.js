"use strict";
/**
 * Utility for retrying connections with exponential backoff
 */
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
const DEFAULT_OPTIONS = {
    maxRetries: 30, // 30 retries
    initialDelayMs: 2000, // Start with 2 seconds
    maxDelayMs: 30000, // Max 30 seconds between retries
    backoffMultiplier: 1.5, // Exponential backoff
};
/**
 * Retry a function with exponential backoff
 */
function retryWithBackoff(fn_1) {
    return __awaiter(this, arguments, void 0, function* (fn, options = {}, context = 'Connection') {
        const opts = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
        let delay = opts.initialDelayMs;
        let lastError = null;
        for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
            try {
                return yield fn();
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt === opts.maxRetries) {
                    console.error(`[${context}] Failed after ${attempt + 1} attempts:`, lastError.message);
                    throw lastError;
                }
                const errorMsg = lastError.message || String(lastError);
                const isConnectionError = errorMsg.includes('ECONNREFUSED') ||
                    errorMsg.includes('ENOTFOUND') ||
                    errorMsg.includes('ETIMEDOUT') ||
                    errorMsg.includes('connection') ||
                    errorMsg.includes('not ready');
                if (isConnectionError) {
                    console.log(`[${context}] Connection attempt ${attempt + 1}/${opts.maxRetries + 1} failed (${errorMsg}). Retrying in ${delay}ms...`);
                }
                else {
                    // Non-connection errors might be configuration issues, but still retry a few times
                    if (attempt < 3) {
                        console.warn(`[${context}] Attempt ${attempt + 1} failed: ${errorMsg}. Retrying...`);
                    }
                    else {
                        console.error(`[${context}] Non-connection error after ${attempt + 1} attempts:`, errorMsg);
                        throw lastError;
                    }
                }
                yield new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
            }
        }
        throw lastError || new Error(`${context} failed after ${opts.maxRetries + 1} attempts`);
    });
}
