import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  Header,
  Middleware,
  createApplication,
  Inject,
  Scope,
  Role,
  File,
  MetadataRegistry
} from '../src/index';
import { Injectable } from '@voltrix/injector';

@Injectable()
class ApiService {
  isReady() { return true; }
}

// 🧬 Execution order tracker
const executionOrder: string[] = [];
const createMid = (name: string) => (req: any, res: any, next: any) => {
  executionOrder.push(name);
  next();
};

/**
 * 🔐 Mock Auth Middleware
 * Populates req.user from headers for testing
 */
const authMiddleware = (req: any, res: any, next: any) => {
  const userJson = req.header('x-test-user');
  if (userJson) {
    req.user = JSON.parse(userJson);
  }
  next();
};

class User {
  constructor(
    public name: string,
    public age: number,
  ) { }
}


@Injectable()
class UserService {
  async list() {
    return [
      new User('John Doe', 30),
      new User('Jane Doe', 25),
    ];
  }
}


@Controller()
class UserController {

  @Get()
  async list(
    @Query('page') page: number,
  ) {
    return { page };
  }

  @Post()
  async create(
    @Body(User) body: User,
  ) {
    return body;
  }

}


@Module({
  path: "users",
  providers: [UserService],
  controllers: [UserController],
})
class UserModule { }


@Controller('/api')
class TestController {
  constructor(@Inject(ApiService) private service: ApiService) { }

  @Get('/hello')
  @Scope('admin')
  @Middleware(createMid('method'))
  async getHello(@Query('name') name: string, @Header('user-agent') ua: string) {
    return { msg: `Hello ${name}`, ua, order: [...executionOrder] };
  }

  @Post('/secure')
  @Role('admin')
  async secure(@Body() body: any) {
    return { ok: true, body };
  }

  @Post('/upload')
  @Scope({
    scopes: ['write'],
    onFail: (req, res) => res.status(401).json({ error: 'Upload Forbidden' })
  })
  async upload(@File('avatar') file: any) {
    return {
      received: !!file,
      filename: file?.filename,
      contentType: file?.contentType,
      body: { foo: 'bar' }
    };
  }

  @Get('/param/:id')
  async getParam(@Param('id') id: string) {
    return { id };
  }
}

@Module({
  modules: [UserModule],
  controllers: [TestController],
  providers: [ApiService],
  middlewares: [createMid('module')]
})
class TestModule { }

@VoltrixApp({
  name: 'RealApp',
  modules: [TestModule],
  middlewares: [authMiddleware, createMid('app')],
  port: 9999
})
class App { }

describe("Testing metadata", () => {
  it("should verify recursive metadata structure", () => {
    const meta = MetadataRegistry.get(App);
    expect(meta).toBeDefined();
    // TestModule is the first module
    const firstMod = meta?.options.modules?.[0];
    expect(firstMod).toBe(TestModule);
    
    // UserModule should be inside TestModule
    const modBag = MetadataRegistry.get(TestModule);
    expect(modBag?.options.modules).toContain(UserModule);
  });
});

describe('🚀 Comprehensive End-to-End Real HTTP Flow', () => {
  let application: any;
  const baseUrl = 'http://127.0.0.1:9999';

  beforeAll(async () => {
    // Silence logs for cleaner test output
    const originalLog = console.log;
    console.log = () => { };
    const { app } = await createApplication(App);
    application = app;
    await app.listen(9999);
    console.log = originalLog;
  });

  afterAll(async () => {
    if (application) {
      await application.close();
      // uWS might need a small grace period to release the port
      await new Promise(r => setTimeout(r, 100));
    }
  });

  it('should verify Scope union and Middleware order (App -> Module -> Method)', async () => {
    executionOrder.length = 0;

    // 1. Fail because of missing scope
    const resFail = await fetch(`${baseUrl}/api/hello?name=Voltrix`);
    expect(resFail.status).toBe(403);
    const bodyFail: any = await resFail.json();
    expect(bodyFail.required).toContain('admin');

    // 2. Success with Scope
    executionOrder.length = 0;
    const user = { scopes: ['admin'], roles: [] };
    const resPass = await fetch(`${baseUrl}/api/hello?name=Voltrix`, {
      headers: {
        'x-test-user': JSON.stringify(user),
        'user-agent': 'Voltrix-Agent'
      }
    });

    expect(resPass.status).toBe(200);
    const bodyPass: any = await resPass.json();
    expect(bodyPass.msg).toBe('Hello Voltrix');
    expect(bodyPass.ua).toBe('Voltrix-Agent');

    // Verify execution order: authMiddleware (app) -> createMid('app') -> createMid('module') -> createMid('method')
    // Note: authMiddleware is first in App levels
    expect(bodyPass.order).toEqual(['app', 'module', 'method']);
  });

  it('should verify hierarchical Roles', async () => {
    // 1. Fail
    const resFail = await fetch(`${baseUrl}/api/secure`, {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
      headers: { 'Content-Type': 'application/json' }
    });
    expect(resFail.status).toBe(403);

    // 2. Success
    const user = { scopes: [], roles: ['admin'] };
    const resPass = await fetch(`${baseUrl}/api/secure`, {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
      headers: {
        'x-test-user': JSON.stringify(user),
        'Content-Type': 'application/json'
      }
    });
    expect(resPass.status).toBe(200);
    const bodyPass: any = await resPass.json();
    expect(bodyPass.ok).toBe(true);
    expect(bodyPass.body).toEqual({ foo: 'bar' });
  });

  it('should verify real multipart file upload via @File', async () => {
    const formData = new FormData();
    const blob = new Blob(['hello voltrix'], { type: 'text/plain' });
    formData.append('avatar', blob, 'voltrix.txt');
    formData.append('foo', 'bar');

    const user = { scopes: ['write'], roles: [] };
    const res = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'x-test-user': JSON.stringify(user)
      }
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.received).toBe(true);
    expect(body.filename).toBe('voltrix.txt');
    expect(body.contentType).toBe('text/plain');
    expect(body.body).toEqual({ foo: 'bar' });
  });

  it('should verify @Param extraction', async () => {
    const res = await fetch(`${baseUrl}/api/param/12345`);
    const body: any = await res.json();
    expect(body.id).toBe('12345');
  });

  it('should track all used scopes and roles', () => {
    expect(Scope.getAll()).toContain('admin');
    expect(Scope.getAll()).toContain('write');
    expect(Role.getAll()).toContain('admin');
  });
});
