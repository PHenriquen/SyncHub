import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [WorkspacesModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
