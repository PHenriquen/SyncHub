import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createCommentSchema, type CreateCommentInput } from '@synchub/contracts';
import type { AuthenticatedUser } from '../../common/authenticated-user.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CommentsService } from './comments.service.js';

@ApiTags('task comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'tasks/:taskId/comments', version: '1' })
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('taskId', new ParseUUIDPipe()) taskId: string) {
    return this.commentsService.list(user.sub, taskId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) input: CreateCommentInput,
  ) {
    return this.commentsService.create(user.sub, taskId, input);
  }
}
