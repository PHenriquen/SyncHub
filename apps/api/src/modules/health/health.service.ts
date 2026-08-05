import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SYNCHUB_VERSION } from '../../app.constants.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  live() {
    return {
      status: 'ok',
      service: 'synchub-api',
      version: SYNCHUB_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        ...this.live(),
        dependencies: { database: 'ready' },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'synchub-api',
        dependencies: { database: 'unavailable' },
      });
    }
  }
}
