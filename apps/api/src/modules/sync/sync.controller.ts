import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/authenticated-user.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SyncService } from './sync.service.js';

interface ConnectRepositoryBody {
  workspaceId?: string;
  projectId?: string;
  fullName?: string;
  repositoryId?: string | number;
  defaultBranch?: string;
  private?: boolean;
}

@ApiTags('synchronization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'sync', version: '1' })
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @ApiQuery({ name: 'workspaceId', required: true })
  @Get('overview')
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.syncService.overview(user.sub, workspaceId);
  }

  @ApiQuery({ name: 'workspaceId', required: true })
  @Get('pull-requests')
  pullRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.syncService.listPullRequests(user.sub, workspaceId);
  }

  @Post('repositories')
  connect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ConnectRepositoryBody,
  ) {
    return this.syncService.connectRepository(user.sub, body);
  }

  @Post('repositories/:repositoryId/run')
  run(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', new ParseUUIDPipe()) repositoryId: string,
  ) {
    return this.syncService.runManualSync(user.sub, repositoryId);
  }
}
