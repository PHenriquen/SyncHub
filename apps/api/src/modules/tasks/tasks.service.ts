import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import type { CreateTaskInput, UpdateTaskStatusInput } from '@synchub/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(userId: string, projectId: string) {
    const project = await this.getProject(projectId);
    await this.access.requireRole(userId, project.workspaceId, WorkspaceRole.VIEWER);

    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true, githubLinks: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { number: 'asc' }],
    });
  }

  async listAssigned(userId: string, workspaceId: string) {
    await this.access.requireRole(userId, workspaceId, WorkspaceRole.VIEWER);

    return this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        project: { workspaceId, archivedAt: null },
      },
      include: {
        project: { select: { id: true, key: true, name: true } },
        _count: { select: { comments: true, githubLinks: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async create(userId: string, input: CreateTaskInput) {
    const project = await this.getProject(input.projectId);
    await this.access.requireRole(userId, project.workspaceId, WorkspaceRole.MEMBER);
    await this.validateAssignee(input.assigneeId, project.workspaceId);

    return this.prisma.$transaction(async (transaction) => {
      const projectCounter = await transaction.project.update({
        where: { id: input.projectId },
        data: { nextTaskNumber: { increment: 1 } },
        select: { nextTaskNumber: true },
      });
      const number = projectCounter.nextTaskNumber - 1;

      return transaction.task.create({
        data: {
          projectId: input.projectId,
          number,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assigneeId: input.assigneeId,
          creatorId: userId,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          activities: {
            create: {
              workspaceId: project.workspaceId,
              projectId: project.id,
              actorId: userId,
              type: 'TASK_CREATED',
              summary: `${project.key}-${number} was created`,
            },
          },
        },
        include: { assignee: { select: { id: true, name: true, avatarUrl: true } } },
      });
    });
  }

  async updateStatus(userId: string, taskId: string, input: UpdateTaskStatusInput) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw new NotFoundException('Task was not found');

    await this.access.requireRole(userId, task.project.workspaceId, WorkspaceRole.MEMBER);
    if (task.status === input.status) return task;

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: input.status,
        completedAt: input.status === 'DONE' ? new Date() : null,
        activities: {
          create: {
            workspaceId: task.project.workspaceId,
            projectId: task.projectId,
            actorId: userId,
            type: 'TASK_STATUS_CHANGED',
            summary: `${task.project.key}-${task.number} moved to ${input.status}`,
            metadata: { previousStatus: task.status, nextStatus: input.status },
          },
        },
      },
    });
  }

  private async validateAssignee(assigneeId: string | undefined, workspaceId: string) {
    if (!assigneeId) return;
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
    });
    if (!membership) throw new BadRequestException('Assignee is not a workspace member');
  }

  private async getProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.archivedAt) throw new NotFoundException('Project was not found');
    return project;
  }
}
