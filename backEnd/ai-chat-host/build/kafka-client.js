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
exports.kafkaWrapper = void 0;
const kafkajs_1 = require("kafkajs");
const constants_1 = require("./config/constants");
class KafkaWrapper {
    get client() {
        if (!this._client) {
            throw new Error("Cannot access Kafka client before connecting");
        }
        return this._client;
    }
    get producer() {
        if (!this._producer) {
            throw new Error("Cannot access Kafka producer before connecting");
        }
        return this._producer;
    }
    consumer(groupId, maxInFlightRequests = 1) {
        if (!this._client) {
            throw new Error("Cannot access Kafka client before connecting");
        }
        return this._client.consumer({
            groupId,
            sessionTimeout: 30000,
            heartbeatInterval: 3000,
            maxInFlightRequests,
            allowAutoTopicCreation: false,
        });
    }
    connect(brokers, clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const finalBrokers = brokers || constants_1.KAFKA_CONFIG.BROKERS;
            const finalClientId = clientId || constants_1.KAFKA_CONFIG.CLIENT_ID;
            this._client = new kafkajs_1.Kafka({
                clientId: finalClientId,
                brokers: finalBrokers,
                logLevel: 2, // WARN level
                logCreator: () => ({ level, log, namespace, label }) => {
                    const logMessage = typeof log === 'string' ? log : (log.message || JSON.stringify(log));
                    const errorMessage = typeof log === 'object' && log.error
                        ? (typeof log.error === 'string' ? log.error : log.error.message || log.error)
                        : '';
                    // Filter out partition errors
                    if ((logMessage === null || logMessage === void 0 ? void 0 : logMessage.includes('does not host this topic-partition')) ||
                        (errorMessage === null || errorMessage === void 0 ? void 0 : errorMessage.includes('does not host this topic-partition'))) {
                        return;
                    }
                    if (level >= 2) {
                        if (level === 2) {
                            console.warn(`[Kafka ${namespace}] ${logMessage}`);
                        }
                        else if (level >= 1) {
                            console.error(`[Kafka ${namespace}] ${logMessage}`, typeof log === 'object' && log.error ? log.error : '');
                        }
                    }
                }
            });
            this._producer = this._client.producer();
            yield this._producer.connect();
            console.log("✅ [AI Chat Host] Kafka connected");
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield ((_a = this._producer) === null || _a === void 0 ? void 0 : _a.disconnect());
            console.log("✅ [AI Chat Host] Kafka disconnected");
        });
    }
}
exports.kafkaWrapper = new KafkaWrapper();
