import { Injectable } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import type { CreateWorkspaceInput } from '@synchub/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceAccessService } from './workspace-access.service.js';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  listForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: { memberships: { some: { userId } } },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { projects: true, memberships: true } },
        memberships: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listMembers(userId: string, workspaceId: string) {
    await this.access.requireRole(userId, workspaceId, WorkspaceRole.VIEWER);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  create(userId: string, input: CreateWorkspaceInput) {
    return this.prisma.workspace.create({
      data: {
        name: input.name,
        slug: input.slug,
        memberships: { create: { userId, role: WorkspaceRole.OWNER } },
        activities: {
          create: {
            actorId: userId,
            type: 'WORKSPACE_CREATED',
            summary: `Workspace ${input.name} was created`,
          },
        },
      },
    });
  }
}
