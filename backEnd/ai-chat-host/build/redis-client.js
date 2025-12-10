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
exports.redisWrapper = void 0;
const redis_1 = require("redis");
const constants_1 = require("./config/constants");
class RedisWrapper {
    get client() {
        if (!this._client) {
            throw new Error("Cannot access Redis client before connecting");
        }
        return this._client;
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this._client = (0, redis_1.createClient)({
                socket: {
                    host: constants_1.REDIS_CONFIG.HOST,
                    port: constants_1.REDIS_CONFIG.PORT,
                },
            });
            this._client.on('error', (err) => {
                console.error('❌ [AI Chat Host] Redis Client Error:', err);
            });
            this._client.on('connect', () => {
                console.log('✅ [AI Chat Host] Redis connecting...');
            });
            this._client.on('ready', () => {
                console.log('✅ [AI Chat Host] Redis connected');
            });
            yield this._client.connect();
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._client) {
                yield this._client.quit();
                console.log('✅ [AI Chat Host] Redis disconnected');
            }
        });
    }
}
exports.redisWrapper = new RedisWrapper();
