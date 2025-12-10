// Configuration constants for AR Avatar Service

export const AVATAR_CONFIG = {
  // Model Generation
  MODEL_GENERATION_TIMEOUT: parseInt(process.env.MODEL_GENERATION_TIMEOUT || '30000', 10), // 30 seconds
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3', 10),
  
  // Storage
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'azure', // 'azure' | 's3'
  CDN_BASE_URL: process.env.CDN_BASE_URL || '',
  
  // 3D Providers
  READY_PLAYER_ME_API_KEY: process.env.READY_PLAYER_ME_API_KEY || '',
  MESHY_API_KEY: process.env.MESHY_API_KEY || '',
  MESHY_API_BASE_URL: process.env.MESHY_API_BASE_URL || 'https://api.meshy.ai',
  
  // LLM for Description Generation
  LLM_PROVIDER: process.env.LLM_PROVIDER || 'openai', // 'openai' | 'claude'
  LLM_MODEL: process.env.LLM_MODEL || 'gpt-4o-mini',
  LLM_API_KEY: process.env.LLM_API_KEY || '',
  
  // Kafka
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'ar-avatar',
  
  // Model Formats
  DEFAULT_MODEL_FORMAT: process.env.DEFAULT_MODEL_FORMAT || 'glb', // 'glb' | 'vrm' | 'live2d'
  
  // Generation Strategy
  GENERATION_STRATEGY: process.env.GENERATION_STRATEGY || 'hybrid', // 'pre-generate' | 'on-demand' | 'hybrid'
};

export const TTS_CONFIG = {
  // TTS Provider
  TTS_PROVIDER: process.env.TTS_PROVIDER || 'openai', // 'openai' | 'google' | 'azure'
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GOOGLE_TTS_API_KEY: process.env.GOOGLE_TTS_API_KEY || '',
  AZURE_TTS_KEY: process.env.AZURE_TTS_KEY || '',
  AZURE_TTS_REGION: process.env.AZURE_TTS_REGION || '',
  
  // Token Service
  TOKEN_LIFETIME_SECONDS: parseInt(process.env.TOKEN_LIFETIME_SECONDS || '300', 10), // 5 minutes
  TOKEN_REFRESH_THRESHOLD: parseFloat(process.env.TOKEN_REFRESH_THRESHOLD || '0.8'), // Refresh at 80%
  
  // Rate Limiting
  MAX_REQUESTS_PER_TOKEN: parseInt(process.env.MAX_REQUESTS_PER_TOKEN || '100', 10), // per hour
  MAX_CHARACTERS_PER_REQUEST: parseInt(process.env.MAX_CHARACTERS_PER_REQUEST || '5000', 10),
};

