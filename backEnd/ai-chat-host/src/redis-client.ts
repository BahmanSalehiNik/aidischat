import { createClient, RedisClientType } from 'redis';
import { REDIS_CONFIG } from './config/constants';

class RedisWrapper {
  private _client?: RedisClientType;

  get client() {
    if (!this._client) {
      throw new Error("Cannot access Redis client before connecting");
    }
    return this._client;
  }

  async connect() {
    this._client = createClient({
      socket: {
        host: REDIS_CONFIG.HOST,
        port: REDIS_CONFIG.PORT,
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

    await this._client.connect();
  }

  async disconnect() {
    if (this._client) {
      await this._client.quit();
      console.log('✅ [AI Chat Host] Redis disconnected');
    }
  }
}

export const redisWrapper = new RedisWrapper();

