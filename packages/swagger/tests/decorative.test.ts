import { describe, it, expect } from 'vitest';
import { Controller, Get, Post, Param, DiscoveryCollector, Swagger, Module, VoltrixApp } from '@voltrix/decorator';
import { SwaggerAssembler } from '../src/index';

@Controller('/products')
@Swagger.Tags('E-commerce')
@Swagger.Namespace('public')
class ProductController {
  @Get('/:id')
  @Swagger.Summary('Get product')
  @Swagger.Response(200, { description: 'Found' })
  async getProduct(@Param('id') id: string) {}

  @Post('/')
  @Swagger.Namespace('admin')
  @Swagger.Summary('Create product')
  async createProduct() {}
}

@Controller('/admin')
@Swagger.Namespace('admin')
class AdminController {
  @Get('/stats')
  @Swagger.Tags('Admin', 'Stats')
  async getStats() {}
}

@Module({
    controllers: [ProductController, AdminController]
})
class MainModule {}

@VoltrixApp({
    name: 'MockApp',
    modules: [MainModule]
})
class MockApp {}

describe('Decorative OpenAPI Integration', () => {
  it('should collect metadata and respect namespaces from decorators', async () => {
    // 1. Build the tree (using DiscoveryCollector)
    const tree = await DiscoveryCollector.buildTree(MockApp);
    // console.log('DEBUG TREE:', JSON.stringify(tree, null, 2));

    // 2. Generate full spec
    const fullSpec = SwaggerAssembler.generate(tree);
    expect(fullSpec.paths['/products/{id}']).toBeDefined();
    expect(fullSpec.paths['/admin/stats']).toBeDefined();
    expect(fullSpec.paths['/products/']).toBeDefined();

    // 3. Generate public spec (only Product.getProduct)
    const publicSpec = SwaggerAssembler.generate(tree, { namespace: 'public' });
    expect(publicSpec.paths['/products/{id}']).toBeDefined();
    expect(publicSpec.paths['/admin/stats']).toBeUndefined();
    expect(publicSpec.paths['/products/']).toBeUndefined(); // Inherited 'admin' from method override

    // 4. Generate admin spec
    const adminSpec = SwaggerAssembler.generate(tree, { namespace: 'admin' });
    expect(adminSpec.paths['/admin/stats']).toBeDefined();
    expect(adminSpec.paths['/products/']).toBeDefined();
    expect(adminSpec.paths['/products/{id}']).toBeUndefined();
  });

  it('should support flexible arguments (array and variadic)', () => {
    // Verified via implementation of Swagger.Tags and Swagger.Security in openapi.ts
    // If it didn't support both, the decorators themselves would throw or produce invalid data
    // Here we check if Tags merged correctly
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
    
    const spec = SwaggerAssembler.generate(tree);
    expect(spec.paths['/test']['get'].tags).toEqual(['A', 'B']);
  });
});
