import { Injectable } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(userId: string, workspaceId: string, limit = 30) {
    await this.access.requireRole(userId, workspaceId, WorkspaceRole.VIEWER);

    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 30;

    return this.prisma.activityEvent.findMany({
      where: { workspaceId },
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
        project: { select: { id: true, key: true, name: true } },
        task: { select: { id: true, number: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  }
}
