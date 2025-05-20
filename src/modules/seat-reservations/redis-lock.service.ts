import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';

@Injectable()
export class RedisLockService {
  private redisClient;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    this.initRedisClient();
  }

  private async initRedisClient() {
    this.redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    });

    await this.redisClient.connect();

    this.redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
  }

  /**
   * Cố gắng lấy khóa với timeout
   * @param key Khóa cần khóa
   * @param ttl Thời gian timeout tính bằng mili giây
   * @returns true nếu lấy được khóa, false nếu không
   */
  async acquireLock(key: string, ttl: number): Promise<boolean> {
    const lockId = uuidv4();
    const lockKey = `lock:${key}`;

    try {
      // Sử dụng SET với NX và PX options
      const result = await this.redisClient.set(lockKey, lockId, {
        NX: true, // Chỉ set nếu key chưa tồn tại
        PX: ttl, // Thời gian hết hạn tính bằng milliseconds
      });

      return result === 'OK';
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return false;
    }
  }

  /**
   * Giải phóng khóa
   * @param key Khóa cần giải phóng
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = `lock:${key}`;
    try {
      await this.redisClient.del(lockKey);
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }

  /**
   * Kiểm tra xem khóa có tồn tại không
   * @param key Khóa cần kiểm tra
   * @returns true nếu khóa tồn tại, false nếu không
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    try {
      const value = await this.redisClient.get(lockKey);
      return value !== null;
    } catch (error) {
      console.error('Error checking lock:', error);
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}
