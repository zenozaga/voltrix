import { describe, it, expect, beforeAll } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Get,
  Post,
  Scope,
  Role,
  createApplication,
  SecurityRegistry
} from '../src/index';

@Controller('/a')
class ControllerA {
  @Get()
  @Scope('scope-a')
  async a() { return {}; }
}

@Controller('/b')
class ControllerB {
  @Post()
  @Role('role-b')
  async b() { return {}; }
}

@Module({
  controllers: [ControllerA, ControllerB],
})
class TestModule { }

@VoltrixApp({
  name: 'RegistryApp',
  modules: [TestModule],
  port: 9005
})
class App { }

describe('04-registry.test.ts - SecurityRegistry Tracking', () => {
  beforeAll(async () => {
    // Discovery happens during createApplication
    await createApplication(App);
  });

  it('should have all defined scopes in the registry', () => {
    const scopes = SecurityRegistry.getAllScopes();
    expect(scopes).toContain('scope-a');
  });

  it('should have all defined roles in the registry', () => {
    const roles = SecurityRegistry.getAllRoles();
    expect(roles).toContain('role-b');
  });
});
