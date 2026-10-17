import { Module } from '@nestjs/common';
import { GitHubAppClient } from './github-app.client.js';
import { GitHubController } from './github.controller.js';
import { GitHubService } from './github.service.js';

@Module({
  controllers: [GitHubController],
  providers: [GitHubService, GitHubAppClient],
  exports: [GitHubService, GitHubAppClient],
})
export class GitHubModule {}
