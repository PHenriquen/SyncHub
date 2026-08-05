import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import type { CreateProjectInput } from '@synchub/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(userId: string, workspaceId: string) {
    await this.access.requireRole(userId, workspaceId, WorkspaceRole.VIEWER);

    return this.prisma.project.findMany({
      where: { workspaceId, archivedAt: null },
      include: {
        _count: { select: { tasks: true, repositories: true } },
        tasks: { select: { status: true } },
        repositories: { select: { id: true, fullName: true, defaultBranch: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getById(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        repositories: { select: { id: true, fullName: true, defaultBranch: true } },
        _count: { select: { tasks: true } },
      },
    });
    if (!project || project.archivedAt) throw new NotFoundException('Project was not found');

    await this.access.requireRole(userId, project.workspaceId, WorkspaceRole.VIEWER);
    return project;
  }

  async create(userId: string, input: CreateProjectInput) {
    await this.access.requireRole(userId, input.workspaceId, WorkspaceRole.MEMBER);

    return this.prisma.project.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        key: input.key,
        description: input.description,
        visibility: input.visibility,
        activities: {
          create: {
            workspaceId: input.workspaceId,
            actorId: userId,
            type: 'PROJECT_CREATED',
            summary: `Project ${input.key} was created`,
          },
        },
      },
    });
  }
}
