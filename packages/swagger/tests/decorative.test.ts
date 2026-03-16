import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Controller, Get, Post, Param, DiscoveryCollector, Module, VoltrixApp } from '@voltrix/decorator';
import { Swagger, generateFromTree as generate } from '../src/decorator/index';

@Controller('/products')
@Swagger.Tags('E-commerce')
@Swagger.Namespace('public')
class ProductController {

  @Get(':id')
  @Swagger.Summary('Get product')
  @Swagger.Response(200, { description: 'Found' })
  async getProduct(@Param('id') id: string) {

  }

  @Post('/')
  @Swagger.Namespace('admin')
  @Swagger.Summary('Create product')
  async createProduct() { }
}

@Controller('/admin')
@Swagger.Namespace('admin')
class AdminController {
  @Get('/stats')
  @Swagger.Tags('Admin', 'Stats')
  async getStats() { }
}

@Module({
  controllers: [ProductController, AdminController]
})
class MainModule { }

@VoltrixApp({
  name: 'MockApp',
  modules: [MainModule]
})
class MockApp { }

class ResponseDto { name: string = 'test'; }

@Controller('/test')
class TestController {
  @Get('/')
  getData(): ResponseDto { return new ResponseDto(); }
}

@Module({ controllers: [TestController] })
class TestModule { }

@VoltrixApp({ name: 'App', modules: [TestModule] })
class App { }

describe('Decorative OpenAPI Integration', () => {
  it('should collect metadata and respect namespaces from decorators', async () => {
    // 1. Build the tree (using DiscoveryCollector)
    const tree = await DiscoveryCollector.buildTree(MockApp);

    // 2. Generate full spec
    const spec = generate(tree);

    expect(spec.paths['/products/{id}']).toBeDefined();
    expect(spec.paths['/products/{id}']?.get?.tags).toContain('E-commerce');
    expect(spec.paths['/products']).toBeDefined();

    // 3. Generate public spec (only Product.getProduct)
    const publicSpec = generate(tree, { namespace: 'public' });
    expect(publicSpec.paths['/products/{id}']).toBeDefined();
    expect(publicSpec.paths['/admin/stats']).toBeUndefined();
    expect(publicSpec.paths['/products']).toBeUndefined(); // Inherited 'admin' from method override

    // 4. Generate admin spec
    const adminSpec = generate(tree, { namespace: 'admin' });
    expect(adminSpec.paths['/admin/stats']).toBeDefined();
    expect(adminSpec.paths['/products']).toBeDefined();
    expect(adminSpec.paths['/products/{id}']).toBeUndefined();
  });

  it('should support flexible arguments (array and variadic)', () => {
    const tree = {
      modules: [{
        controllers: [{
          routes: [{
            fullPath: '/test', method: 'GET', meta: { openapi: { tags: ['A', 'B'] } }
          }],
          meta: { openapi: {} },
          subModules: []
        }],
        subModules: [],
        meta: { openapi: {} }
      }]
    } as any;

    const spec = generate(tree);
    expect(spec.paths['/test']?.get?.tags).toEqual(['A', 'B']);
  });

  it('should infer response from return type', async () => {
    // Manually define the metadata that the compiler would normally emit
    // This allows testing the inference logic without changing the test runner transformer
    Reflect.defineMetadata('design:returntype', ResponseDto, TestController.prototype, 'getData');

    const tree = await DiscoveryCollector.buildTree(App);
    const spec = generate(tree);

    const pathKey = '/test';
    const response = spec.paths[pathKey]?.get?.responses?.['200'];

    expect(response).toBeDefined();
    if (response?.content) {
      expect(response.content['application/json']?.schema?.$ref).toContain('ResponseDto');
    } else {
      throw new Error(`Response content undefined for ${pathKey}`);
    }
  });
});
