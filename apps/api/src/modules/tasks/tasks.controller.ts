import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  createTaskSchema,
  updateTaskStatusSchema,
  type CreateTaskInput,
  type UpdateTaskStatusInput,
} from '@synchub/contracts';
import type { AuthenticatedUser } from '../../common/authenticated-user.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'tasks', version: '1' })
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiQuery({ name: 'workspaceId', required: true })
  @Get('assigned')
  listAssigned(
    @CurrentUser() user: AuthenticatedUser,
    @Query('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.tasksService.listAssigned(user.sub, workspaceId);
  }

  @ApiQuery({ name: 'projectId', required: true })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.tasksService.list(user.sub, projectId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTaskSchema)) input: CreateTaskInput,
  ) {
    return this.tasksService.create(user.sub, input);
  }

  @Patch(':taskId/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body(new ZodValidationPipe(updateTaskStatusSchema)) input: UpdateTaskStatusInput,
  ) {
    return this.tasksService.updateStatus(user.sub, taskId, input);
  }
}
