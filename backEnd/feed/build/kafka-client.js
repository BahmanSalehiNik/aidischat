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
// shared/kafka/kafka-wrapper.ts
const kafkajs_1 = require("kafkajs");
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
    consumer(groupId) {
        if (!this._client) {
            throw new Error("Cannot access Kafka client before connecting");
        }
        return this._client.consumer({
            groupId,
            // Note: autoCommit is disabled in baseListener.ts consumer.run() call
            // sessionTimeout: How long before Kafka considers consumer dead (triggers redelivery of uncommitted messages)
            // heartbeatInterval: How often consumer sends heartbeats to stay alive
            // These are CRITICAL for message redelivery when ack() is not called
            sessionTimeout: 30000, // 30s - if consumer doesn't heartbeat for 30s, Kafka marks it dead and redelivers uncommitted messages
            heartbeatInterval: 3000, // 3s - send heartbeat every 3s to stay alive
            maxInFlightRequests: 5, // Higher throughput - feed posts are independent, order doesn't matter
            allowAutoTopicCreation: false, // Don't auto-create topics
        });
    }
    connect(brokers_1) {
        return __awaiter(this, arguments, void 0, function* (brokers, clientId = "app") {
            this._client = new kafkajs_1.Kafka({
                clientId,
                brokers,
                // Suppress noisy partition errors - they're often transient and harmless
                logLevel: 2, // WARN level
                logCreator: () => ({ level, log, namespace, label }) => {
                    // Check if log is a string or object
                    const logMessage = typeof log === 'string' ? log : (log.message || JSON.stringify(log));
                    const errorMessage = typeof log === 'object' && log.error
                        ? (typeof log.error === 'string' ? log.error : log.error.message || log.error)
                        : '';
                    // Filter out partition errors - these are often transient during startup
                    // The error appears in log.error field as a string in KafkaJS logs
                    if ((logMessage === null || logMessage === void 0 ? void 0 : logMessage.includes('does not host this topic-partition')) ||
                        (errorMessage === null || errorMessage === void 0 ? void 0 : errorMessage.includes('does not host this topic-partition')) ||
                        ((logMessage === null || logMessage === void 0 ? void 0 : logMessage.includes('ListOffsets')) && (errorMessage === null || errorMessage === void 0 ? void 0 : errorMessage.includes('does not host')))) {
                        // Suppress these specific errors - they're harmless and transient
                        return;
                    }
                    // Only log WARN and ERROR level messages (excluding the filtered ones)
                    if (level >= 2) {
                        if (level === 2) { // WARN
                            console.warn(`[Kafka ${namespace}] ${logMessage}`);
                        }
                        else if (level >= 1) { // ERROR
                            console.error(`[Kafka ${namespace}] ${logMessage}`, typeof log === 'object' && log.error ? log.error : '');
                        }
                    }
                }
            });
            this._producer = this._client.producer();
            yield this._producer.connect();
            console.log("Kafka connected");
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield ((_a = this._producer) === null || _a === void 0 ? void 0 : _a.disconnect());
        });
    }
}
exports.kafkaWrapper = new KafkaWrapper();
