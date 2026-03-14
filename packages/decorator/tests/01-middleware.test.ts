import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Get,
  Middleware,
  createApplication
} from '../src/index';

const executionOrder: string[] = [];
const createMid = (name: string) => (req: any, res: any, next: any) => {
  executionOrder.push(name);
  next();
};

@Controller()
@Middleware(createMid('controller'))
class TestController {
  @Get('/mid')
  @Middleware(createMid('method'))
  async getMid() {
    return { ok: true, order: [...executionOrder] };
  }
}

@Module({
  controllers: [TestController],
  middlewares: [createMid('module')]
})
class TestModule { }

@VoltrixApp({
  name: 'TestApp',
  modules: [TestModule],
  middlewares: [createMid('app')],
  port: 9002
})
class App { }

describe('01-middleware.test.ts - Middleware Execution Order', () => {
  let application: any;
  let baseUrl = 'http://127.0.0.1:9002';

  beforeAll(async () => {
    const { app } = await createApplication(App);
    application = app;
    await app.listen(9002);
  });

  afterAll(async () => {
    if (application) {
      await application.close();
      await new Promise(r => setTimeout(r, 100));
    }
  });

  it('should execute middlewares in order (App -> Module -> Controller -> Method)', async () => {
    executionOrder.length = 0;
    const res = await fetch(`${baseUrl}/mid`);
    expect(res.status).toBe(200);
    const body: any = await res.json();

    // Expected order: app -> module -> controller -> method
    expect(body.order).toEqual(['app', 'module', 'controller', 'method']);
  });
});
