import { describe, it, expect, vi } from 'vitest';
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
  MetadataRegistry,
  Inject
} from '../src/index';
import { Injectable } from '@voltrix/injector';

@Injectable()
class ApiService {
  private ready = false;
  async onInit() {
    this.ready = true;
  }
  isReady() { return this.ready; }
}

@Controller('/test')
class TestController {
  constructor(@Inject(ApiService) private service: ApiService) {
    // console.log('TestController initialized. Service:', !!this.service);
  }

  @Get('/hello')
  @Middleware((req, res, next) => {
    (req as any).context.mid = true;
    next();
  })
  getHello(@Query('name') name: string) {
    console.log('getHello called with name:', name);
    try {
      return { 
        msg: `Hello ${name || 'World'}`, 
        ready: this.service.isReady() 
      };
    } catch (e: any) {
      console.error('getHello FAILURE:', e.stack);
      throw e;
    }
  }

  @Post('/data/:id')
  saveData(@Param('id') id: string, @Body() body: any) {
    return { id, body };
  }
}

@Module({
  controllers: [TestController],
  providers: [ApiService]
})
class TestModule {}

@VoltrixApp({
  name: 'IntegrationApp',
  modules: [TestModule]
})
class App {}

describe('🚀 Voltrix Full Decorator Flow', () => {

  it('should build a correct discovery tree and resolve dependencies', async () => {
    try {
      const { tree, container } = await createApplication(App);

      // Verify Discovery Tree
      expect(tree.name).toBe('IntegrationApp');
      expect(tree.modules).toHaveLength(1);
      expect(tree.modules[0].controllers).toHaveLength(1);
      
      const ctrlNode = tree.modules[0].controllers[0];
      expect(ctrlNode.fullPath).toBe('/test');
      expect(ctrlNode.routes).toHaveLength(2);

      // Verify DI and Lifecycle
      const service = container.resolve(ApiService);
      expect(service.isReady()).toBe(true);
    } catch (e: any) {
      console.error('CRITICAL BOOTSTRAP FAILURE:', e.stack || e.message);
      throw e;
    }
  });

  it('should generate high-performance resolvers that extract parameters correctly', async () => {
    const { app } = await createApplication(App);
    
    // Simulate uWS routes
    // @ts-ignore
    const routes = app._routes;
    const helloRoute = routes.find((r: any) => r.method === 'GET' && r.path === '/test/hello');
    const postRoute = routes.find((r: any) => r.method === 'POST' && r.path === '/test/data/:id');

    expect(helloRoute).toBeDefined();
    expect(postRoute).toBeDefined();

    // Mock Req/Res for GET
    const mockReq = {
      query: { name: 'Voltrix' },
      body: {},
      params: {},
      headers: {},
      context: {},
      header: (n: string) => undefined,
      json: async () => ({})
    } as any;

    const mockRes = {
      send: vi.fn(),
      status: vi.fn().mockReturnThis()
    } as any;

    // Execute Handler
    await helloRoute.handler(mockReq, mockRes);
    expect(mockRes.send).toHaveBeenCalledWith({ 
      msg: 'Hello Voltrix', 
      ready: true 
    });

    // Mock Req/Res for POST
    const mockPostReq = {
      query: {},
      params: { id: '42' },
      json: async () => ({ foo: 'bar' })
    } as any;

    await postRoute.handler(mockPostReq, mockRes);
    expect(mockRes.send).toHaveBeenCalledWith({ 
      id: '42', 
      body: { foo: 'bar' } 
    });
  });

  it('should preserve O(1) metadata bag access', () => {
    const bag = MetadataRegistry.get(TestController);
    expect(bag).toBeDefined();
    expect(bag?.type).toBe('controller');
    expect(bag?.routes.has('getHello')).toBe(true);
  });
});
