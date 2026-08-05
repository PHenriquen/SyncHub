require('dotenv').config();

const fs = require('fs').promises;
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { listModules } = require('./modules/catalog');
const {
  applyCorsHeaders,
  parseBoolean,
  parseJsonBody,
  sendJson,
  sendNoContent,
} = require('./server/http-utils');
const { JsonDb } = require('./persistence/json-db');
const { AuthService } = require('./auth/auth-service');
const { CoreManager } = require('./core/core-manager');

function parseActiveModules() {
  const rawValue = String(process.env.SYNCHUB_ACTIVE_MODULES || 'freelancer').trim();
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }
  const matched = String(header).match(/^Bearer\s+(.+)$/i);
  return matched ? matched[1].trim() : null;
}

function isPublicRoute(method, pathname) {
  if (method === 'GET' && pathname === '/api/health') {
    return true;
  }
  if (method === 'POST' && pathname === '/api/auth/register') {
    return true;
  }
  if (method === 'POST' && pathname === '/api/auth/login') {
    return true;
  }
  return false;
}

function resolveDbFilePath() {
  const raw = String(process.env.SYNCHUB_DB_FILE || './data/synchub-db.json').trim();
  if (path.isAbsolute(raw)) {
    return raw;
  }
  return path.resolve(process.cwd(), raw);
}

function getStaticFilePath(pathname) {
  const webRoot = path.resolve(process.cwd(), 'src', 'web');
  if (pathname === '/app' || pathname === '/app/' || pathname === '/app/index.html') {
    return path.resolve(webRoot, 'index.html');
  }

  if (!pathname.startsWith('/app/')) {
    return null;
  }

  const relativePath = pathname.replace('/app/', '');
  const safePath = path.resolve(webRoot, relativePath);
  if (!safePath.startsWith(webRoot)) {
    return null;
  }
  return safePath;
}

function getContentType(filePath) {
  if (filePath.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }
  if (filePath.endsWith('.js')) {
    return 'application/javascript; charset=utf-8';
  }
  if (filePath.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  if (filePath.endsWith('.png')) {
    return 'image/png';
  }
  return 'application/octet-stream';
}

async function tryServeStatic(req, res, pathname) {
  if (req.method !== 'GET') {
    return false;
  }

  if (pathname === '/') {
    res.writeHead(302, { Location: '/app' });
    res.end();
    return true;
  }

  const staticPath = getStaticFilePath(pathname);
  if (!staticPath) {
    return false;
  }

  try {
    const content = await fs.readFile(staticPath);
    res.writeHead(200, {
      'Content-Type': getContentType(staticPath),
      'Cache-Control': 'no-store',
    });
    res.end(content);
    return true;
  } catch {
    sendJson(res, 404, { error: 'Static file not found.' });
    return true;
  }
}

async function bootstrap() {
  const activeModules = parseActiveModules();
  const focusThreshold = parseNumber(process.env.SYNCHUB_FOCUS_THRESHOLD, 70);
  const sessionTtlHours = parseNumber(process.env.SYNCHUB_SESSION_TTL_HOURS, 24 * 30);
  const dbFilePath = resolveDbFilePath();

  const db = new JsonDb(dbFilePath);
  await db.init();

  const authService = new AuthService({
    db,
    sessionTtlHours,
  });
  await authService.cleanupExpiredSessions();

  const coreManager = new CoreManager({
    db,
    defaultActiveModules: activeModules,
    defaultFocusThreshold: focusThreshold,
  });

  const server = http.createServer(async (req, res) => {
    applyCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      sendNoContent(res);
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;
    const method = req.method;

    try {
      const servedStatic = await tryServeStatic(req, res, pathname);
      if (servedStatic) {
        return;
      }

      if (method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, {
          status: 'ok',
          service: 'synchub-core',
          now: new Date().toISOString(),
          auth: 'enabled',
          dbFilePath,
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/register') {
        const body = await parseJsonBody(req);
        const registered = await authService.register(body);
        await coreManager.getUserCore(registered.user.id);
        sendJson(res, 201, registered);
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await parseJsonBody(req);
        const loggedIn = await authService.login(body);
        await coreManager.getUserCore(loggedIn.user.id);
        sendJson(res, 200, loggedIn);
        return;
      }

      if (method === 'GET' && pathname === '/api/auth/me') {
        const token = getBearerToken(req);
        const authContext = await authService.authenticate(token);
        if (!authContext) {
          sendJson(res, 401, { error: 'Invalid or expired session.' });
          return;
        }
        sendJson(res, 200, {
          user: authContext.user,
          sessionExpiresAt: authContext.sessionExpiresAt,
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        const token = getBearerToken(req);
        const authContext = await authService.authenticate(token);
        if (!authContext) {
          sendJson(res, 401, { error: 'Invalid or expired session.' });
          return;
        }
        await authService.logout(authContext.token);
        sendNoContent(res);
        return;
      }

      if (!isPublicRoute(method, pathname)) {
        const token = getBearerToken(req);
        const authContext = await authService.authenticate(token);
        if (!authContext) {
          sendJson(res, 401, { error: 'Missing, invalid or expired bearer token.' });
          return;
        }
        req.authContext = authContext;
      }

      const userId = req.authContext.user.id;

      if (method === 'GET' && pathname === '/api/modules') {
        const active = await coreManager.run(userId, (core) => core.listActiveModules());
        sendJson(res, 200, {
          availableModules: listModules(),
          activeModules: active,
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/integrations') {
        const result = await coreManager.run(userId, (core) => ({
          items: core.listIntegrations(),
        }));
        sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && pathname === '/api/integrations/connect') {
        const body = await parseJsonBody(req);
        const result = await coreManager.run(
          userId,
          (core) => core.connectIntegration(body),
          { persist: true }
        );
        sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && pathname === '/api/integrations/disconnect') {
        const body = await parseJsonBody(req);
        const result = await coreManager.run(
          userId,
          (core) => core.disconnectIntegration(body),
          { persist: true }
        );
        sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && pathname === '/api/modules/activate') {
        const body = await parseJsonBody(req);
        const moduleId = body.moduleId ? String(body.moduleId).trim() : '';
        if (!moduleId) {
          sendJson(res, 400, { error: 'moduleId is required.' });
          return;
        }
        const result = await coreManager.run(
          userId,
          (core) => {
            const activated = core.activateModule(moduleId);
            return {
              activated,
              activeModules: core.listActiveModules(),
            };
          },
          { persist: true }
        );
        if (!result.activated) {
          sendJson(res, 404, { error: 'Module not found.', moduleId });
          return;
        }
        sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && pathname === '/api/modules/deactivate') {
        const body = await parseJsonBody(req);
        const moduleId = body.moduleId ? String(body.moduleId).trim() : '';
        if (!moduleId) {
          sendJson(res, 400, { error: 'moduleId is required.' });
          return;
        }
        const result = await coreManager.run(
          userId,
          (core) => ({
            deactivated: core.deactivateModule(moduleId),
            activeModules: core.listActiveModules(),
          }),
          { persist: true }
        );
        sendJson(res, 200, result);
        return;
      }

      if (method === 'GET' && pathname === '/api/focus-mode') {
        const focusMode = await coreManager.run(userId, (core) => core.getFocusModeState());
        sendJson(res, 200, focusMode);
        return;
      }

      if (method === 'POST' && pathname === '/api/focus-mode') {
        const body = await parseJsonBody(req);
        const result = await coreManager.run(
          userId,
          (core) => {
            const enabled = parseBoolean(body.enabled, core.getFocusModeState().enabled);
            const threshold = parseNumber(body.threshold, core.getFocusModeState().threshold);
            return core.setFocusMode(enabled, threshold);
          },
          { persist: true }
        );
        sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && pathname === '/api/messages') {
        const body = await parseJsonBody(req);
        const result = await coreManager.run(
          userId,
          (core) => core.ingestMessage(body),
          { persist: true }
        );
        sendJson(res, 201, result);
        return;
      }

      if (method === 'GET' && pathname === '/api/inbox') {
        const limit = parseNumber(requestUrl.searchParams.get('limit'), 50);
        const focus = parseBoolean(requestUrl.searchParams.get('focus'), false);
        const result = await coreManager.run(userId, (core) => ({
          focusMode: core.getFocusModeState(),
          items: core.getInbox({ limit, focus }),
        }));
        sendJson(res, 200, result);
        return;
      }

      if (method === 'GET' && pathname === '/api/inbox/buckets') {
        const limit = parseNumber(requestUrl.searchParams.get('limit'), 200);
        const focus = parseBoolean(requestUrl.searchParams.get('focus'), false);
        const result = await coreManager.run(userId, (core) =>
          core.getInboxBuckets({ limit, focus })
        );
        sendJson(res, 200, result);
        return;
      }

      const inboxTaskMatch = pathname.match(/^\/api\/inbox\/([^/]+)\/task$/);
      if (method === 'POST' && inboxTaskMatch) {
        const messageId = decodeURIComponent(inboxTaskMatch[1]);
        const body = await parseJsonBody(req);
        const task = await coreManager.run(
          userId,
          (core) => core.createTaskFromMessage(messageId, body.title),
          { persist: true }
        );
        sendJson(res, 201, task);
        return;
      }

      const inboxConvertMatch = pathname.match(/^\/api\/inbox\/([^/]+)\/convert$/);
      if (method === 'POST' && inboxConvertMatch) {
        const messageId = decodeURIComponent(inboxConvertMatch[1]);
        const body = await parseJsonBody(req);
        const result = await coreManager.run(
          userId,
          (core) => core.convertMessage(messageId, body.type, body),
          { persist: true }
        );
        sendJson(res, 201, result);
        return;
      }

      const inboxReplyMatch = pathname.match(/^\/api\/inbox\/([^/]+)\/reply$/);
      if (method === 'POST' && inboxReplyMatch) {
        const messageId = decodeURIComponent(inboxReplyMatch[1]);
        const body = await parseJsonBody(req);
        const notification = await coreManager.run(
          userId,
          (core) => core.sendManualReply(messageId, body.message),
          { persist: true }
        );
        sendJson(res, 201, notification);
        return;
      }

      if (method === 'POST' && pathname === '/api/tasks') {
        const body = await parseJsonBody(req);
        const task = await coreManager.run(
          userId,
          (core) => core.createTask(body),
          { persist: true }
        );
        sendJson(res, 201, task);
        return;
      }

      if (method === 'GET' && pathname === '/api/tasks') {
        const status = requestUrl.searchParams.get('status');
        const moduleId = requestUrl.searchParams.get('moduleId');
        const result = await coreManager.run(userId, (core) => ({
          items: core.listTasks({
            status: status || undefined,
            moduleId: moduleId || undefined,
          }),
        }));
        sendJson(res, 200, result);
        return;
      }

      const updateTaskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (method === 'PATCH' && updateTaskMatch) {
        const taskId = decodeURIComponent(updateTaskMatch[1]);
        const body = await parseJsonBody(req);
        const task = await coreManager.run(
          userId,
          (core) => core.updateTask(taskId, body),
          { persist: true }
        );
        sendJson(res, 200, task);
        return;
      }

      if (method === 'GET' && pathname === '/api/notifications') {
        const limit = parseNumber(requestUrl.searchParams.get('limit'), 50);
        const result = await coreManager.run(userId, (core) => ({
          items: core.listNotifications(limit),
        }));
        sendJson(res, 200, result);
        return;
      }

      if (method === 'GET' && pathname === '/api/events') {
        const limit = parseNumber(requestUrl.searchParams.get('limit'), 100);
        const result = await coreManager.run(userId, (core) => ({
          items: core.listEvents(limit),
        }));
        sendJson(res, 200, result);
        return;
      }

      if (method === 'GET' && pathname === '/api/notes') {
        const limit = parseNumber(requestUrl.searchParams.get('limit'), 100);
        const result = await coreManager.run(userId, (core) => ({
          items: core.listNotes(limit),
        }));
        sendJson(res, 200, result);
        return;
      }

      if (method === 'GET' && pathname === '/api/reports/weekly') {
        const date = requestUrl.searchParams.get('date');
        const result = await coreManager.run(userId, (core) =>
          core.getWeeklyReport(date || undefined)
        );
        sendJson(res, 200, result);
        return;
      }

      if (method === 'GET' && pathname === '/api/privacy-mode') {
        const result = await coreManager.run(userId, (core) => ({
          mode: core.getPrivacyMode(),
        }));
        sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && pathname === '/api/privacy-mode') {
        const body = await parseJsonBody(req);
        const result = await coreManager.run(
          userId,
          (core) => ({
            mode: core.setPrivacyMode(body.mode),
          }),
          { persist: true }
        );
        sendJson(res, 200, result);
        return;
      }

      const contextMatch = pathname.match(/^\/api\/context\/([^/]+)$/);
      if (method === 'GET' && contextMatch) {
        const contactRef = decodeURIComponent(contextMatch[1]);
        const result = await coreManager.run(userId, (core) =>
          core.getUnifiedContext(contactRef)
        );
        sendJson(res, 200, result);
        return;
      }

      if (method === 'GET' && pathname === '/api/daily-overview') {
        const date = requestUrl.searchParams.get('date');
        const overview = await coreManager.run(userId, (core) =>
          core.getDailyOverview(date || undefined)
        );
        sendJson(res, 200, overview);
        return;
      }

      if (method === 'GET' && pathname === '/api/automations/rules') {
        const result = await coreManager.run(userId, (core) => ({
          items: core.listAutomationRules(),
        }));
        sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && pathname === '/api/automations/rules') {
        const body = await parseJsonBody(req);
        const rule = await coreManager.run(
          userId,
          (core) => core.addAutomationRule(body),
          { persist: true }
        );
        sendJson(res, 201, rule);
        return;
      }

      const deleteRuleMatch = pathname.match(/^\/api\/automations\/rules\/([^/]+)$/);
      if (method === 'DELETE' && deleteRuleMatch) {
        const ruleId = decodeURIComponent(deleteRuleMatch[1]);
        const removed = await coreManager.run(
          userId,
          (core) => core.removeAutomationRule(ruleId),
          { persist: true }
        );
        if (!removed) {
          sendJson(res, 404, { error: 'Rule not found.', ruleId });
          return;
        }
        sendNoContent(res);
        return;
      }

      if (method === 'POST' && pathname === '/api/seed/sample') {
        const result = await coreManager.run(
          userId,
          (core) => {
            const imported = core.seedSampleData().length;
            return {
              imported,
              overview: core.getDailyOverview(),
            };
          },
          { persist: true }
        );
        sendJson(res, 201, result);
        return;
      }

      sendJson(res, 404, {
        error: 'Route not found.',
        method,
        pathname,
      });
    } catch (error) {
      if (error && error.message === 'Payload too large.') {
        sendJson(res, 413, { error: error.message });
        return;
      }
      if (error && error.message === 'Invalid JSON body.') {
        sendJson(res, 400, { error: error.message });
        return;
      }
      if (error && typeof error.message === 'string' && error.message) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      sendJson(res, 500, {
        error: 'Unexpected server error.',
      });
    }
  });

  const port = parseNumber(process.env.SYNCHUB_PORT, 8080);
  server.listen(port, () => {
    console.log(`[SyncHub Core] API online em http://localhost:${port}`);
    console.log('[SyncHub Core] Autenticacao habilitada (Bearer token).');
    console.log(`[SyncHub Core] Base local: ${dbFilePath}`);
    console.log('[SyncHub Core] Endpoints iniciais:');
    console.log('  POST /api/auth/register');
    console.log('  POST /api/auth/login');
    console.log('  GET  /api/auth/me');
    console.log('  GET  /api/integrations');
    console.log('  POST /api/messages');
    console.log('  GET  /api/daily-overview');
    console.log('  WEB  /app');
  });
}

bootstrap().catch((error) => {
  console.error('[SyncHub Core] Falha no bootstrap:', error);
  process.exit(1);
});
