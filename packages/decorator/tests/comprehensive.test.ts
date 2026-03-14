import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  VoltrixApp, 
  Module, 
  Controller, 
  Get, 
  Post, 
  Query, 
  Body, 
  Param, 
  Middleware,
  createApplication,
  Inject,
  Scope,
  File
} from '../src/index';
import { Injectable } from '@voltrix/injector';

@Injectable()
class ApiService {
  private ready = false;
  async onInit() { this.ready = true; }
  isReady() { return this.ready; }
}

// 🧬 Execution order tracker
const executionOrder: string[] = [];

const createMid = (name: string) => (req: any, res: any, next: any) => {
  executionOrder.push(name);
  if (!req.context) req.context = {};
  req.context[name] = true;
  next();
};

@Controller('/hierarchical')
@Scope('ctrl')
@Middleware(createMid('ctrl'))
class HierarchicalController {
  @Get('/test')
  @Scope('meth')
  @Middleware(createMid('meth'))
  test() {
    return { ok: true };
  }
}

@Module({
  controllers: [HierarchicalController],
  providers: [ApiService],
  middlewares: [createMid('mod')]
})
@Scope('mod')
class TestModule {}

@VoltrixApp({
  name: 'HierarchicalApp',
  modules: [TestModule],
  middleware: [createMid('app')]
})
@Scope('app')
class App {}

describe('🚀 Hierarchical Decorator Flow', () => {

  beforeEach(() => {
    executionOrder.length = 0;
  });

  it('should merge Scopes and chain Middlewares across all 4 levels', async () => {
    const { app } = await createApplication(App);
    // @ts-ignore
    const routes = app._routes;
    const testRoute = routes.find((r: any) => r.path === '/hierarchical/test');

    const mockRes = {
      send: vi.fn(),
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      headersSent: false,
      isAborted: false
    } as any;

    // 1. Unauthorized (Missing one level)
    const mockReqPart = {
      user: { scopes: ['app', 'mod', 'ctrl'] }, // Missing 'meth'
      context: {}
    } as any;
    
    await testRoute.handler(mockReqPart, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    const lastCall = mockRes.json.mock.calls[0][0];
    expect(lastCall.required).toContain('app');
    expect(lastCall.required).toContain('mod');
    expect(lastCall.required).toContain('ctrl');
    expect(lastCall.required).toContain('meth');

    // 2. Authorized (Full)
    const mockReqFull = {
      user: { scopes: ['app', 'mod', 'ctrl', 'meth'] },
      context: {}
    } as any;
    
    await testRoute.handler(mockReqFull, mockRes);
    
    // Check Middleware Execution Order
    expect(executionOrder).toEqual(['app', 'mod', 'ctrl', 'meth']);
    expect(mockRes.json).toHaveBeenCalledWith({ ok: true });
  });

  it('should support Custom Scope Fail Handler at any level (Method wins)', async () => {
    @Controller('/fail')
    class FailController {
      @Get('/')
      @Scope({ 
        scopes: ['secret'], 
        onFail: (req, res) => res.status(418).json({ msg: 'I am a teapot' }) 
      })
      fail() { return 'not reached'; }
    }

    @Module({ controllers: [FailController] })
    class FailModule {}

    @VoltrixApp({ name: 'FailApp', modules: [FailModule] })
    class FailApp {}

    const { app } = await createApplication(FailApp);
    // @ts-ignore
    const route = app._routes.find((r: any) => r.path === '/fail');

    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      headersSent: false
    } as any;

    await route.handler({ user: { scopes: [] } } as any, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(418);
    expect(mockRes.json).toHaveBeenCalledWith({ msg: 'I am a teapot' });
  });

  it('should audit all used scopes accurately', () => {
     const all = Scope.getAll();
     expect(all).toContain('app');
     expect(all).toContain('mod');
     expect(all).toContain('ctrl');
     expect(all).toContain('meth');
     expect(all).toContain('secret');
  });
});
