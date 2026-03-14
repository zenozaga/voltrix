import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Get,
  createApplication,
  Inject
} from '../src/index';
import { Injectable } from '@voltrix/injector';

@Injectable()
class GlobalService {
  getData() { return 'global'; }
}

@Injectable()
class ModuleService {
  constructor(@Inject(GlobalService) private global: GlobalService) {}
  getData() { return `module + ${this.global.getData()}`; }
}

@Controller('/di')
class DIController {
  constructor(
    @Inject(ModuleService) private moduleService: ModuleService,
    @Inject(GlobalService) private globalService: GlobalService
  ) {}

  @Get('/test')
  async test() {
    return {
      module: this.moduleService.getData(),
      global: this.globalService.getData()
    };
  }
}

@Module({
  controllers: [DIController],
  providers: [ModuleService]
})
class TestModule { }

@VoltrixApp({
  name: 'DIApp',
  modules: [TestModule],
  providers: [GlobalService],
  port: 9006
})
class App { }

describe('05-di.test.ts - Dependency Injection', () => {
  let application: any;
  let baseUrl = 'http://127.0.0.1:9006/di';

  beforeAll(async () => {
    const { app } = await createApplication(App);
    application = app;
    await app.listen(9006);
  });

  afterAll(async () => {
    if (application) {
      await application.close();
      await new Promise(r => setTimeout(r, 100));
    }
  });

  it('should inject providers from app and module levels', async () => {
    const res = await fetch(`${baseUrl}/test`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.global).toBe('global');
    expect(body.module).toBe('module + global');
  });
});
