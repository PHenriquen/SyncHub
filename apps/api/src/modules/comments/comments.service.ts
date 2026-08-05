import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import type { CreateCommentInput } from '@synchub/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(userId: string, taskId: string) {
    const task = await this.getTask(taskId);
    await this.access.requireRole(userId, task.project.workspaceId, WorkspaceRole.VIEWER);

    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, taskId: string, input: CreateCommentInput) {
    const task = await this.getTask(taskId);
    await this.access.requireRole(userId, task.project.workspaceId, WorkspaceRole.MEMBER);

    return this.prisma.$transaction(async (transaction) => {
      const comment = await transaction.taskComment.create({
        data: { taskId, authorId: userId, body: input.body },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      });

      await transaction.activityEvent.create({
        data: {
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId,
          actorId: userId,
          type: 'COMMENT_CREATED',
          summary: `Comment added to ${task.project.key}-${task.number}`,
        },
      });

      return comment;
    });
  }

  private async getTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw new NotFoundException('Task was not found');
    return task;
  }
}
