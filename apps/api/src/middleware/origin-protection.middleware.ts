import { ForbiddenException, Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const originExemptPaths = new Set(['/api/v1/github/webhooks']);

@Injectable()
export class OriginProtectionMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(request: Request, _response: Response, next: NextFunction) {
    const requestPath = request.originalUrl.split('?')[0] ?? request.path;
    if (safeMethods.has(request.method) || originExemptPaths.has(requestPath)) {
      next();
      return;
    }

    const origin = request.get('origin');
    if (!origin) {
      next();
      return;
    }

    const allowedOrigins = new Set([this.config.getOrThrow<string>('WEB_ORIGIN')]);
    if (this.config.get('NODE_ENV') !== 'production') {
      allowedOrigins.add(`${request.protocol}://${request.get('host')}`);
    }

    if (!allowedOrigins.has(origin)) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    next();
  }
}
