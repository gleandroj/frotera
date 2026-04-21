import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    private configService: ConfigService,
    app: INestApplicationContext,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const isDev = this.configService.get<string>('NODE_ENV') === 'development';

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    try {
      const connectWithTimeout = Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        ),
      ]);

      await connectWithTimeout;
      this.adapterConstructor = createAdapter(pubClient, subClient);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Redis connection failed: ${message}`);

      if (!isDev) {
        throw error;
      }

      console.warn('⚠️  Continuing without Redis in development mode (Socket.io may not work across multiple instances)');
      await pubClient.quit().catch(() => {});
      await subClient.quit().catch(() => {});
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
