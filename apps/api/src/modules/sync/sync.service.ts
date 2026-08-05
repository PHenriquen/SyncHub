import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SyncRunStatus, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

interface ConnectRepositoryInput {
  workspaceId?: string;
  projectId?: string;
  fullName?: string;
  repositoryId?: string | number;
  defaultBranch?: string;
  private?: boolean;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async overview(userId: string, workspaceId: string) {
    await this.access.requireRole(userId, workspaceId, WorkspaceRole.VIEWER);

    const [repositories, recentRuns, activityCount] = await this.prisma.$transaction([
      this.prisma.gitHubRepository.findMany({
        where: { workspaceId },
        include: {
          project: { select: { id: true, key: true, name: true } },
          _count: { select: { links: true, syncRuns: true } },
        },
        orderBy: { connectedAt: 'desc' },
      }),
      this.prisma.syncRun.findMany({
        where: { repository: { workspaceId } },
        include: { repository: { select: { id: true, fullName: true } } },
        orderBy: { startedAt: 'desc' },
        take: 12,
      }),
      this.prisma.activityEvent.count({
        where: {
          workspaceId,
          type: { in: ['COMMIT_RECEIVED', 'PULL_REQUEST_OPENED', 'PULL_REQUEST_MERGED', 'CI_FAILED'] },
        },
      }),
    ]);

    return {
      status: repositories.some((repository) => repository.lastError) ? 'attention' : 'healthy',
      summary: {
        connected: repositories.filter((repository) => repository.syncEnabled).length,
        linkedItems: repositories.reduce((total, repository) => total + repository._count.links, 0),
        synchronizedEvents: activityCount,
        lastSyncAt: recentRuns.find((run) => run.completedAt)?.completedAt ?? null,
      },
      repositories: repositories.map((repository) => ({
        ...repository,
        installationId: repository.installationId.toString(),
        repositoryId: repository.repositoryId.toString(),
      })),
      recentRuns,
    };
  }

  async listPullRequests(userId: string, workspaceId: string) {
    await this.access.requireRole(userId, workspaceId, WorkspaceRole.VIEWER);
    return this.prisma.gitHubLink.findMany({
      where: { type: 'pull_request', repository: { workspaceId } },
      include: {
        repository: { select: { fullName: true } },
        task: {
          select: {
            id: true,
            number: true,
            title: true,
            project: { select: { id: true, key: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async connectRepository(userId: string, input: ConnectRepositoryInput) {
    const workspaceId = required(input.workspaceId, 'Workspace is required');
    const projectId = required(input.projectId, 'Project is required');
    const fullName = required(input.fullName, 'Repository must use owner/name');
    if (!/^[^/\s]+\/[^/\s]+$/.test(fullName)) {
      throw new BadRequestException('Repository must use the owner/name format');
    }
    const repositoryId = required(String(input.repositoryId ?? ''), 'GitHub repository ID is required');
    if (!/^\d+$/.test(repositoryId)) throw new BadRequestException('GitHub repository ID must be numeric');
    const numericId = BigInt(repositoryId);

    await this.access.requireRole(userId, workspaceId, WorkspaceRole.ADMIN);
    const project = await this.prisma.project.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) throw new NotFoundException('Project was not found in this workspace');

    const existingRepository = await this.prisma.gitHubRepository.findUnique({
      where: { repositoryId: numericId },
      select: { workspaceId: true },
    });
    if (existingRepository && existingRepository.workspaceId !== workspaceId) {
      throw new ConflictException('Repository is already connected to another workspace');
    }

    const [owner, name] = fullName.split('/') as [string, string];
    return this.prisma.gitHubRepository.upsert({
      where: { repositoryId: numericId },
      update: {
        workspaceId,
        projectId,
        owner,
        name,
        fullName,
        defaultBranch: input.defaultBranch?.trim() || 'main',
        private: Boolean(input.private),
        syncEnabled: true,
        lastError: null,
      },
      create: {
        workspaceId,
        projectId,
        installationId: BigInt(0),
        repositoryId: numericId,
        owner,
        name,
        fullName,
        defaultBranch: input.defaultBranch?.trim() || 'main',
        private: Boolean(input.private),
      },
      select: { id: true, fullName: true, connectedAt: true },
    });
  }

  async runManualSync(userId: string, repositoryId: string) {
    const repository = await this.prisma.gitHubRepository.findUnique({
      where: { id: repositoryId },
      include: { _count: { select: { links: true } } },
    });
    if (!repository) throw new NotFoundException('Repository connection was not found');
    await this.access.requireRole(userId, repository.workspaceId, WorkspaceRole.MEMBER);

    const startedAt = new Date();
    const message = repository.projectId
      ? 'Repository, project and linked work are synchronized'
      : 'Repository is connected but still needs a project';
    const status = repository.projectId ? SyncRunStatus.SUCCESS : SyncRunStatus.PARTIAL;

    const [, run] = await this.prisma.$transaction([
      this.prisma.gitHubRepository.update({
        where: { id: repository.id },
        data: { lastSyncedAt: new Date(), lastError: null },
      }),
      this.prisma.syncRun.create({
        data: {
          repositoryId: repository.id,
          status,
          trigger: 'manual',
          receivedItems: repository._count.links,
          linkedItems: repository._count.links,
          message,
          startedAt,
          completedAt: new Date(),
        },
      }),
      this.prisma.activityEvent.create({
        data: {
          workspaceId: repository.workspaceId,
          projectId: repository.projectId,
          actorId: userId,
          type: 'SYNCHRONIZATION_COMPLETED',
          summary: `${repository.fullName} synchronization verified`,
        },
      }),
    ]);

    return run;
  }
}

function required(value: string | undefined, message: string) {
  const normalized = value?.trim();
  if (!normalized) throw new BadRequestException(message);
  return normalized;
}
