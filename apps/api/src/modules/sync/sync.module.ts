import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [WorkspacesModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
