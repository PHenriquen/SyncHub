import { PrismaClient, TaskPriority, TaskStatus, WorkspaceRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash('Synchub123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@synchub.local' },
    update: { name: 'Pedro Nogueira', passwordHash },
    create: {
      name: 'Pedro Nogueira',
      email: 'demo@synchub.local',
      passwordHash,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'synchub-lab' },
    update: { name: 'Synchub Lab' },
    create: {
      name: 'Synchub Lab',
      slug: 'synchub-lab',
      activities: {
        create: {
          actorId: user.id,
          type: 'WORKSPACE_CREATED',
          summary: 'Workspace Synchub Lab was created',
        },
      },
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: { role: WorkspaceRole.OWNER },
    create: { workspaceId: workspace.id, userId: user.id, role: WorkspaceRole.OWNER },
  });

  const project = await prisma.project.upsert({
    where: { workspaceId_key: { workspaceId: workspace.id, key: 'SYNC' } },
    update: { name: 'Synchub Platform' },
    create: {
      workspaceId: workspace.id,
      name: 'Synchub Platform',
      key: 'SYNC',
      description: 'GitHub-first delivery traceability platform.',
    },
  });

  const existingTasks = await prisma.task.count({ where: { projectId: project.id } });
  if (existingTasks === 0) {
    await prisma.task.createMany({
      data: [
        {
          projectId: project.id,
          number: 1,
          creatorId: user.id,
          assigneeId: user.id,
          title: 'Connect the first GitHub repository',
          status: TaskStatus.READY,
          priority: TaskPriority.HIGH,
        },
        {
          projectId: project.id,
          number: 2,
          creatorId: user.id,
          title: 'Build pull request activity timeline',
          status: TaskStatus.BACKLOG,
          priority: TaskPriority.MEDIUM,
        },
        {
          projectId: project.id,
          number: 3,
          creatorId: user.id,
          assigneeId: user.id,
          title: 'Publish foundation architecture',
          status: TaskStatus.DONE,
          priority: TaskPriority.MEDIUM,
          completedAt: new Date(),
        },
      ],
    });
  }

  const maximum = await prisma.task.aggregate({
    where: { projectId: project.id },
    _max: { number: true },
  });
  await prisma.project.update({
    where: { id: project.id },
    data: { nextTaskNumber: (maximum._max.number ?? 0) + 1 },
  });

  const repository = await prisma.gitHubRepository.upsert({
    where: { repositoryId: BigInt(10042026) },
    update: { projectId: project.id, workspaceId: workspace.id, syncEnabled: true },
    create: {
      workspaceId: workspace.id,
      projectId: project.id,
      installationId: BigInt(0),
      repositoryId: BigInt(10042026),
      owner: 'pedro-nogueira',
      name: 'synchub',
      fullName: 'pedro-nogueira/synchub',
      defaultBranch: 'main',
      private: false,
      lastSyncedAt: new Date(),
    },
  });

  const existingRuns = await prisma.syncRun.count({ where: { repositoryId: repository.id } });
  if (existingRuns === 0) {
    await prisma.syncRun.create({
      data: {
        repositoryId: repository.id,
        status: 'SUCCESS',
        trigger: 'setup',
        receivedItems: 3,
        linkedItems: 3,
        message: 'Initial project traceability synchronized',
        completedAt: new Date(),
      },
    });
  }

  const deliveredTask = await prisma.task.findUnique({
    where: { projectId_number: { projectId: project.id, number: 3 } },
  });
  if (deliveredTask) {
    await prisma.gitHubLink.upsert({
      where: {
        repositoryId_type_externalId: {
          repositoryId: repository.id,
          type: 'pull_request',
          externalId: 'synchub-foundation-pr',
        },
      },
      update: { taskId: deliveredTask.id, state: 'merged' },
      create: {
        taskId: deliveredTask.id,
        repositoryId: repository.id,
        type: 'pull_request',
        externalId: 'synchub-foundation-pr',
        number: 12,
        url: 'https://github.com/',
        state: 'merged',
        metadata: { source: 'demo', milestone: 'foundation' },
      },
    });
  }

  const synchronizedActivity = await prisma.activityEvent.count({
    where: { workspaceId: workspace.id, type: 'PULL_REQUEST_MERGED' },
  });
  if (synchronizedActivity === 0) {
    await prisma.activityEvent.create({
      data: {
        workspaceId: workspace.id,
        projectId: project.id,
        taskId: deliveredTask?.id,
        actorId: user.id,
        type: 'PULL_REQUEST_MERGED',
        summary: 'Merged PR #12 and synchronized delivery with SYNC-3',
        metadata: { repository: repository.fullName, source: 'demo' },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
