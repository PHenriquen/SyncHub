import { Controller, Get, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/authenticated-user.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ActivityService } from './activity.service.js';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'activity', version: '1' })
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @ApiQuery({ name: 'workspaceId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityService.list(user.sub, workspaceId, Number(limit ?? 30));
  }
}
