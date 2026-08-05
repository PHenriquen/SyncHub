import { Injectable } from '@nestjs/common';
import { TaskStatus, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

const activeStatuses: TaskStatus[] = [
  TaskStatus.READY,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.BLOCKED,
];

const terminalStatuses = new Set<TaskStatus>([TaskStatus.DONE, TaskStatus.CANCELED]);

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async getDashboard(userId: string, workspaceId: string) {
    await this.access.requireRole(userId, workspaceId, WorkspaceRole.VIEWER);

    const [statusGroups, boardTasks, activities, projects] = await this.prisma.$transaction([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { project: { workspaceId } },
        _count: { _all: true },
      }),
      this.prisma.task.findMany({
        where: { project: { workspaceId }, status: { in: activeStatuses } },
        include: {
          project: { select: { key: true } },
          assignee: { select: { name: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 24,
      }),
      this.prisma.activityEvent.findMany({
        where: { workspaceId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.project.findMany({
        where: { workspaceId, archivedAt: null },
        include: {
          tasks: { select: { status: true } },
          repositories: { select: { fullName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const counts = Object.fromEntries(
      statusGroups.map((group) => [group.status, group._count._all]),
    ) as Partial<Record<TaskStatus, number>>;
    const activeTasks = activeStatuses.reduce((total, status) => total + (counts[status] ?? 0), 0);

    return {
      metrics: {
        activeTasks,
        inReview: counts.IN_REVIEW ?? 0,
        blocked: counts.BLOCKED ?? 0,
        done: counts.DONE ?? 0,
      },
      board: activeStatuses.map((status) => ({
        status,
        tasks: boardTasks.filter((task) => task.status === status),
      })),
      activities,
      projects: projects.map((project) => {
        const openTasks = project.tasks.filter(
          (task) => !terminalStatuses.has(task.status),
        );
        const blocked = project.tasks.filter((task) => task.status === TaskStatus.BLOCKED).length;
        const health = Math.max(20, 100 - blocked * 20 - openTasks.length * 2);

        return {
          id: project.id,
          key: project.key,
          name: project.name,
          repository: project.repositories[0]?.fullName ?? 'Repository not connected',
          openTasks: openTasks.length,
          health,
        };
      }),
    };
  }
}
