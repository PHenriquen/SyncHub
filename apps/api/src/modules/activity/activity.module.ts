import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

@Module({
  imports: [WorkspacesModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
