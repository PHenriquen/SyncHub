import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityType, Prisma, SyncRunStatus } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class GitHubService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async receiveWebhook(input: {
    eventName?: string;
    deliveryId?: string;
    signature?: string;
    rawBody?: Buffer;
  }) {
    const { eventName, deliveryId, signature, rawBody } = input;
    if (!eventName || !deliveryId || !signature || !rawBody) {
      throw new BadRequestException('Required GitHub webhook data is missing');
    }

    const secret = this.config.get<string>('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('GitHub webhook secret is not configured');
    }

    this.verifySignature(rawBody, signature, secret);
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');

    try {
      await this.prisma.gitHubWebhookDelivery.create({
        data: { deliveryId, eventName, payloadHash },
      });
      const synchronization = await this.processDelivery(eventName, deliveryId, rawBody);
      return { accepted: true, duplicate: false, eventName, deliveryId, synchronization };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { accepted: true, duplicate: true, eventName, deliveryId };
      }
      throw error;
    }
  }

  private async processDelivery(eventName: string, deliveryId: string, rawBody: Buffer) {
    if (!this.prisma.gitHubRepository || !this.prisma.syncRun) {
      return { processed: false, reason: 'Synchronization engine unavailable' };
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as GitHubPayload;
    const externalRepositoryId = payload.repository?.id;
    if (!externalRepositoryId) return { processed: false, reason: 'Repository was not supplied' };

    const repository = await this.prisma.gitHubRepository.findUnique({
      where: { repositoryId: BigInt(externalRepositoryId) },
    });
    if (!repository || !repository.syncEnabled) {
      return { processed: false, reason: 'Repository is not connected' };
    }

    try {
      const event = describeEvent(eventName, payload);
      const task = repository.projectId && event.taskNumber
        ? await this.prisma.task.findUnique({
            where: {
              projectId_number: {
                projectId: repository.projectId,
                number: event.taskNumber,
              },
            },
          })
        : null;

      if (task && event.externalId && event.url) {
        await this.prisma.gitHubLink.upsert({
          where: {
            repositoryId_type_externalId: {
              repositoryId: repository.id,
              type: event.linkType,
              externalId: event.externalId,
            },
          },
          update: { state: event.state, url: event.url, metadata: event.metadata },
          create: {
            repositoryId: repository.id,
            taskId: task.id,
            type: event.linkType,
            externalId: event.externalId,
            number: event.number,
            url: event.url,
            state: event.state,
            metadata: event.metadata,
          },
        });
      }

      await this.prisma.$transaction([
        this.prisma.gitHubRepository.update({
          where: { id: repository.id },
          data: { lastSyncedAt: new Date(), lastError: null },
        }),
        this.prisma.syncRun.create({
          data: {
            repositoryId: repository.id,
            status: SyncRunStatus.SUCCESS,
            trigger: 'webhook',
            eventName,
            deliveryId,
            receivedItems: event.receivedItems,
            linkedItems: task ? 1 : 0,
            message: task ? `Linked to task #${task.number}` : event.message,
            completedAt: new Date(),
          },
        }),
        this.prisma.activityEvent.create({
          data: {
            workspaceId: repository.workspaceId,
            projectId: repository.projectId,
            taskId: task?.id,
            type: event.activityType,
            summary: event.summary,
            metadata: { deliveryId, repository: repository.fullName, linkedTask: task?.number },
          },
        }),
      ]);

      return { processed: true, linkedTask: task?.number ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown synchronization error';
      await this.prisma.$transaction([
        this.prisma.gitHubRepository.update({
          where: { id: repository.id },
          data: { lastError: message },
        }),
        this.prisma.syncRun.create({
          data: {
            repositoryId: repository.id,
            status: SyncRunStatus.FAILED,
            trigger: 'webhook',
            eventName,
            deliveryId,
            message,
            completedAt: new Date(),
          },
        }),
      ]);
      return { processed: false, reason: message };
    }
  }

  private verifySignature(rawBody: Buffer, signature: string, secret: string) {
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new BadRequestException('Invalid GitHub webhook signature');
    }
  }
}

interface GitHubPayload {
  action?: string;
  ref?: string;
  commits?: Array<{ id?: string; message?: string; url?: string }>;
  head_commit?: { id?: string; message?: string; url?: string };
  repository?: { id?: number; full_name?: string };
  pull_request?: {
    id?: number;
    node_id?: string;
    number?: number;
    title?: string;
    html_url?: string;
    merged?: boolean;
    state?: string;
  };
  workflow_run?: { id?: number; name?: string; conclusion?: string; html_url?: string };
}

function describeEvent(eventName: string, payload: GitHubPayload) {
  if (eventName === 'pull_request' && payload.pull_request) {
    const pullRequest = payload.pull_request;
    const merged = Boolean(pullRequest.merged);
    return {
      activityType: merged ? ActivityType.PULL_REQUEST_MERGED : ActivityType.PULL_REQUEST_OPENED,
      summary: `${merged ? 'Merged' : titleCase(payload.action ?? 'updated')} PR #${pullRequest.number ?? '?'}: ${pullRequest.title ?? 'Untitled pull request'}`,
      message: `Pull request ${payload.action ?? 'updated'} received`,
      receivedItems: 1,
      taskNumber: findTaskNumber(pullRequest.title),
      externalId: pullRequest.node_id ?? String(pullRequest.id ?? pullRequest.number ?? ''),
      number: pullRequest.number,
      url: pullRequest.html_url,
      state: merged ? 'merged' : pullRequest.state,
      linkType: 'pull_request',
      metadata: { action: payload.action, merged },
    };
  }

  if (eventName === 'push') {
    const commit = payload.head_commit ?? payload.commits?.at(-1);
    const count = payload.commits?.length ?? (commit ? 1 : 0);
    return {
      activityType: ActivityType.COMMIT_RECEIVED,
      summary: `Received ${count} commit${count === 1 ? '' : 's'} on ${payload.ref?.replace('refs/heads/', '') ?? 'repository'}`,
      message: 'Push synchronized',
      receivedItems: count,
      taskNumber: findTaskNumber(commit?.message),
      externalId: commit?.id,
      number: undefined,
      url: commit?.url,
      state: 'received',
      linkType: 'commit',
      metadata: { ref: payload.ref, message: commit?.message },
    };
  }

  const workflow = payload.workflow_run;
  return {
    activityType: workflow?.conclusion === 'failure' ? ActivityType.CI_FAILED : ActivityType.SYNCHRONIZATION_COMPLETED,
    summary: workflow ? `${workflow.name ?? 'Workflow'} finished with ${workflow.conclusion ?? 'unknown status'}` : `GitHub ${eventName} event synchronized`,
    message: `${eventName} synchronized`,
    receivedItems: 1,
    taskNumber: findTaskNumber(workflow?.name),
    externalId: workflow?.id ? String(workflow.id) : deliveryIdentity(payload),
    number: undefined,
    url: workflow?.html_url,
    state: workflow?.conclusion,
    linkType: eventName,
    metadata: { action: payload.action },
  };
}

export function findTaskNumber(value?: string) {
  const match = value?.match(/\b[A-Z][A-Z0-9]+-(\d+)\b/);
  return match ? Number(match[1]) : undefined;
}

function deliveryIdentity(payload: GitHubPayload) {
  return payload.action ? `${payload.action}-${Date.now()}` : undefined;
}

function titleCase(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1).replaceAll('_', ' ')}`;
}
