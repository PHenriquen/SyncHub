import assert from 'node:assert/strict';
import test from 'node:test';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

const prisma = {
  $queryRaw: async () => [{ '?column?': 1 }],
};

const service = new HealthService(prisma as never);
const controller = new HealthController(service);

test('HealthController reports an operational service', () => {
  const result = controller.getHealth();
  assert.equal(result.status, 'ok');
  assert.equal(result.service, 'synchub-api');
  assert.equal(result.version, '0.4.0');
});

test('HealthController reports database readiness', async () => {
  const result = await controller.ready();
  assert.equal(result.dependencies.database, 'ready');
});
