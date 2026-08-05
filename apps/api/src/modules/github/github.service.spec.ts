import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { findTaskNumber, GitHubService } from './github.service.js';

const secret = 'test-webhook-secret-with-enough-length';
const config = {
  get: (key: string) => (key === 'GITHUB_WEBHOOK_SECRET' ? secret : undefined),
} as ConfigService;

function createService() {
  const deliveries = new Set<string>();
  const prisma = {
    gitHubWebhookDelivery: {
      create: async ({ data }: { data: { deliveryId: string } }) => {
        if (deliveries.has(data.deliveryId)) {
          const error = Object.assign(new Error('duplicate'), { code: 'P2002' });
          throw error;
        }
        deliveries.add(data.deliveryId);
        return data;
      },
    },
  };
  return new GitHubService(config, prisma as never);
}

test('GitHubService accepts a correctly signed payload', async () => {
  const rawBody = Buffer.from('{"action":"opened"}');
  const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const service = createService();

  const result = await service.receiveWebhook({
    eventName: 'pull_request',
    deliveryId: 'delivery-1',
    signature,
    rawBody,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.duplicate, false);
});

test('GitHubService rejects a bad signature', async () => {
  const service = createService();
  await assert.rejects(
    () =>
      service.receiveWebhook({
        eventName: 'push',
        deliveryId: 'delivery-2',
        signature: 'sha256=invalid',
        rawBody: Buffer.from('{}'),
      }),
    BadRequestException,
  );
});

test('GitHub task keys are inferred from delivery text', () => {
  assert.equal(findTaskNumber('feat: finish SYNC-42 synchronization'), 42);
  assert.equal(findTaskNumber('no task key here'), undefined);
});
