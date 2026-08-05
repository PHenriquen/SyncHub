import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { createProjectSchema, type CreateProjectInput } from '@synchub/contracts';
import type { AuthenticatedUser } from '../../common/authenticated-user.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiQuery({ name: 'workspaceId', required: true })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('workspaceId', new ParseUUIDPipe()) workspaceId: string) {
    return this.projectsService.list(user.sub, workspaceId);
  }

  @Get(':projectId')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.projectsService.getById(user.sub, projectId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProjectSchema)) input: CreateProjectInput,
  ) {
    return this.projectsService.create(user.sub, input);
  }
}
