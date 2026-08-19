// config/redis.js
import { createClient } from "redis";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve("config/.env") });

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  init() {
    const redisConfig = process.env.REDIS_URL
      ? {
          url: process.env.REDIS_URL,
          socket: {
            connectTimeout: 15000,
            reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
          },
        }
      : {
          socket: {
            host: process.env.REDIS_HOST || "localhost",
            port: Number(process.env.REDIS_PORT) || 6379,
            connectTimeout: 15000,
            reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
          },
        };

    console.log("🔗 Initializing Redis connection...");

    this.client = createClient(redisConfig);
    this.setupEventListeners();
    this.connect();
  }

  setupEventListeners() {
    this.client.on("connect", () => {
      console.log("🟢 Redis - Connecting...");
    });

    this.client.on("ready", () => {
      console.log("✅ Redis - Connected and ready");
      this.isConnected = true;
    });

    this.client.on("error", (err) => {
      console.error("❌ Redis Client Error:", err.message);
      this.isConnected = false;
    });

    this.client.on("end", () => {
      console.log("🔴 Redis - Disconnected");
      this.isConnected = false;
    });
  }

  async connect() {
    try {
      await this.client.connect();
      console.log("✅ Redis connection established successfully");
    } catch (error) {
      console.error("❌ Redis connection failed:", error.message);
    }
  }

  // ✅ ADDED DISCONNECT METHOD HERE
  async disconnect() {
    try {
      if (this.client?.isOpen) {
        await this.client.quit();
        console.log("🔴 Redis connection closed gracefully");
      }
    } catch (err) {
      console.error("❌ Redis disconnect error:", err.message);
    }
  }

  async get(key) {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error("❌ Redis GET error:", error.message);
      return null;
    }
  }

  async setEx(key, seconds, value) {
    try {
      return await this.client.setEx(key, seconds, value);
    } catch (error) {
      console.error("❌ Redis SETEX error:", error.message);
      return false;
    }
  }

  async del(keys) {
    try {
      if (Array.isArray(keys)) {
        return await this.client.del(...keys);
      }
      return await this.client.del(keys);
    } catch (error) {
      console.error("❌ Redis DEL error:", error.message);
      return 0;
    }
  }

  async incr(key) {
    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error("❌ Redis INCR error:", error.message);
      return 0;
    }
  }

  async keys(pattern) {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error("❌ Redis KEYS error:", error.message);
      return [];
    }
  }

  async flushAll() {
    try {
      return await this.client.flushAll();
    } catch (error) {
      console.error("❌ Redis FLUSHALL error:", error.message);
      return false;
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      console.error("❌ Redis EXISTS error:", error.message);
      return 0;
    }
  }

  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error("❌ Redis TTL error:", error.message);
      return -2;
    }
  }

  async expire(key, seconds) {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      console.error("❌ Redis EXPIRE error:", error.message);
      return false;
    }
  }

  async isReady() {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck() {
    try {
      await this.client.ping();
      const info = await this.client.info("memory");
      return {
        healthy: true,
        connected: this.isConnected,
        memory: info,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}

const redisClient = new RedisClient();
export default redisClient;
