import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Get,
  Post,
  Scope,
  Role,
  createApplication
} from '../src/index';

const authMiddleware = (req: any, res: any, next: any) => {
  const userJson = req.header('x-test-user');
  if (userJson) {
    req.user = JSON.parse(userJson);
  }
  next();
};

@Controller('/security')
class SecurityController {
  @Get('/admin-only')
  @Scope('admin')
  async adminOnly() {
    return { ok: true };
  }

  @Post('/role-admin')
  @Role('admin')
  async roleAdmin() {
    return { ok: true };
  }

  @Get('/prefix')
  @Scope('user:read')
  async prefixScope() {
    return { ok: true };
  }
}

@Module({
  controllers: [SecurityController]
})
class TestModule { }

@VoltrixApp({
  name: 'SecurityPassApp',
  modules: [TestModule],
  middlewares: [authMiddleware],
  port: 9003
})
class App { }

describe('02-security.test.ts - Scopes and Roles', () => {
  let application: any;
  let baseUrl = 'http://127.0.0.1:9003/security';

  beforeAll(async () => {
    const { app } = await createApplication(App);
    application = app;
    await app.listen(9003);
  });

  afterAll(async () => {
    if (application) {
      await application.close();
      await new Promise(r => setTimeout(r, 100));
    }
  });

  it('should deny access if scope is missing', async () => {
    const res = await fetch(`${baseUrl}/admin-only`);
    expect(res.status).toBe(403);
  });

  it('should allow access if scope matches', async () => {
    const user = { scopes: ['admin'], roles: [] };
    const res = await fetch(`${baseUrl}/admin-only`, {
      headers: { 'x-test-user': JSON.stringify(user) }
    });
    expect(res.status).toBe(200);
  });

  it('should allow access with global wildcard "*"', async () => {
    const user = { scopes: ['*'], roles: [] };
    const res = await fetch(`${baseUrl}/admin-only`, {
      headers: { 'x-test-user': JSON.stringify(user) }
    });
    expect(res.status).toBe(200);
  });

  it('should allow access with prefix wildcard "user:*"', async () => {
    const user = { scopes: ['user:*'], roles: [] };
    const res = await fetch(`${baseUrl}/prefix`, {
      headers: { 'x-test-user': JSON.stringify(user) }
    });
    expect(res.status).toBe(200);
  });

  it('should allow access if role matches', async () => {
    const user = { scopes: [], roles: ['admin'] };
    const res = await fetch(`${baseUrl}/role-admin`, {
      method: 'POST',
      headers: { 'x-test-user': JSON.stringify(user) }
    });
    expect(res.status).toBe(200);
  });
});
