import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { GitHubService } from './github.service.js';

@ApiTags('github')
@Controller({ path: 'github', version: '1' })
export class GitHubController {
  constructor(private readonly githubService: GitHubService) {}

  @HttpCode(202)
  @Post('webhooks')
  receiveWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-github-event') eventName?: string,
    @Headers('x-github-delivery') deliveryId?: string,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    return this.githubService.receiveWebhook({
      eventName,
      deliveryId,
      signature,
      rawBody: request.rawBody,
    });
  }
}
