import { describe, it, expect } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Get,
  MetadataRegistry
} from '../src/index';
import { DiscoveryCollector } from '../src/processors/discovery.collector';

@Controller('/user')
class UserController {
  @Get()
  async list() { return []; }
}

@Module({
  path: 'users',
  controllers: [UserController]
})
class UserModule { }

@Module({
  modules: [UserModule]
})
class RootModule { }

@VoltrixApp({
  name: 'MetadataApp',
  modules: [RootModule],
  port: 9007
})
class App { }

describe('06-metadata.test.ts - Metadata Registry and App Tree', () => {
  it('should verify recursive module structure in MetadataRegistry', () => {
    const appMeta = MetadataRegistry.get(App);
    expect(appMeta).toBeDefined();
    expect(appMeta?.options.name).toBe('MetadataApp');
    expect(appMeta?.options.modules).toContain(RootModule);

    const rootMeta = MetadataRegistry.get(RootModule);
    expect(rootMeta).toBeDefined();
    expect(rootMeta?.options.modules).toContain(UserModule);

    const userMeta = MetadataRegistry.get(UserModule);
    expect(userMeta).toBeDefined();
    expect(userMeta?.options.controllers).toContain(UserController);
    expect(userMeta?.options.path).toBe('users');
  });

  it('should verify controller metadata and routes', () => {
    const controllerMeta = MetadataRegistry.get(UserController);
    expect(controllerMeta).toBeDefined();
    expect(controllerMeta?.options.path).toBe('/user');
    
    expect(controllerMeta?.routes.size).toBeGreaterThan(0);
    const routes = Array.from(controllerMeta!.routes.values());
    const listRoute = routes.find(r => r.propertyKey === 'list');
    
    expect(listRoute).toBeDefined();
    expect(listRoute?.method).toBe('GET');
    expect(listRoute?.path).toBe('/');
  });

  it('should verify DiscoveryCollector tree construction', async () => {
    const tree = await DiscoveryCollector.buildTree(App);
    expect(tree).toBeDefined();
    expect(tree.modules.length).toBe(1);
    
    const rootNode = tree.modules[0]!;
    expect(rootNode.target).toBe(RootModule);
    expect(rootNode.subModules.length).toBe(1);
    
    const userNode = rootNode.subModules[0]!;
    expect(userNode.target).toBe(UserModule);
    expect(userNode.controllers.length).toBe(1);
    
    const ctrlNode = userNode.controllers[0]!;
    expect(ctrlNode.target).toBe(UserController);
    expect(ctrlNode.routes.length).toBe(1);
    expect(ctrlNode.routes[0]?.fullPath).toBe('/users/user/');
  });
});
