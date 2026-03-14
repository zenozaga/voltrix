import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Get,
  createApplication
} from '../src/index';

@Controller()
class PingController {
  @Get('/ping')
  async ping() {
    return { message: 'pong' };
  }
}

@Module({
  controllers: [PingController]
})
class TestModule { }

@VoltrixApp({
  name: 'TestApp',
  modules: [TestModule],
  port: 9001
})
class App { }

describe('01-server.test.ts - Basic Bootstrap', () => {
  let application: any;
  let baseUrl = 'http://127.0.0.1:9001';

  beforeAll(async () => {
    const { app } = await createApplication(App);
    application = app;
    await app.listen(9001);
  });

  afterAll(async () => {
    if (application) {
      await application.close();
      await new Promise(r => setTimeout(r, 100));
    }
  });

  it('should respond to /ping', async () => {
    const res = await fetch(`${baseUrl}/ping`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.message).toBe('pong');
  });
});
