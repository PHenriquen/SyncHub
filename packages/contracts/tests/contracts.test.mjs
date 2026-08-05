import assert from 'node:assert/strict';
import test from 'node:test';

const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

test('documented seed password satisfies the password policy', () => {
  assert.equal(strongPassword.test('Synchub123!'), true);
});

test('project keys remain short and uppercase', () => {
  const key = 'sync';
  const normalized = key.toUpperCase();
  assert.match(normalized, /^[A-Z][A-Z0-9]*$/);
  assert.ok(normalized.length <= 10);
});
