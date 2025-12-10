"use strict";
// Configuration constants for AI Chat Host service
Object.defineProperty(exports, "__esModule", { value: true });
exports.KAFKA_CONFIG = exports.NLP_CONFIG = exports.REDIS_CONFIG = exports.ANALYSIS_CONFIG = void 0;
exports.ANALYSIS_CONFIG = {
    // Message window configuration
    WINDOW_SIZE: parseInt(process.env.MESSAGE_WINDOW_SIZE || '10', 10),
    // Analysis trigger thresholds
    TIME_THRESHOLD_MS: parseInt(process.env.TIME_THRESHOLD_MS || '30000', 10), // 30 seconds
    MESSAGE_THRESHOLD: parseInt(process.env.MESSAGE_THRESHOLD || '5', 10), // 5 new messages
    // Cooldown and rate limiting
    MIN_COOLDOWN_MS: parseInt(process.env.MIN_COOLDOWN_MS || '120000', 10), // 2 minutes
    MAX_ANALYSES_PER_HOUR: parseInt(process.env.MAX_ANALYSES_PER_HOUR || '10', 10),
    // Agent invitation limits
    MAX_AGENTS_PER_ROOM: parseInt(process.env.MAX_AGENTS_PER_ROOM || '3', 10),
    MAX_INVITATIONS_PER_ANALYSIS: parseInt(process.env.MAX_INVITATIONS_PER_ANALYSIS || '2', 10),
    AGENT_INVITATION_COOLDOWN_MS: parseInt(process.env.AGENT_INVITATION_COOLDOWN_MS || '3600000', 10), // 1 hour
};
exports.REDIS_CONFIG = {
    HOST: process.env.REDIS_HOST || 'redis',
    PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    WINDOW_TTL_SECONDS: parseInt(process.env.WINDOW_TTL_SECONDS || '3600', 10), // 1 hour
    KEY_PREFIX: 'ai-chat-host:',
};
exports.NLP_CONFIG = {
    PROVIDER: process.env.NLP_PROVIDER || 'ai-gateway', // 'ai-gateway', 'openai', 'google', 'aws'
    MODEL: process.env.NLP_MODEL || 'gpt-4o-mini',
    ENDPOINT: process.env.NLP_ENDPOINT || 'http://ai-gateway:3000',
    ENABLED: process.env.NLP_ENABLED !== 'false', // Default to true
};
exports.KAFKA_CONFIG = {
    BROKERS: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
    CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'ai-chat-host',
};
