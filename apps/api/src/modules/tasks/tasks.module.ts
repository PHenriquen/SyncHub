import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [WorkspacesModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
