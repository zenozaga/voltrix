import { describe, it, expect } from 'vitest';
import { createRouter } from '@voltrix/express';
import { SwaggerAssembler } from '../src/index';
// Note: We'll test with programmatic Router first to avoid dependency on the whole App bootstrap flow in a unit test
// But we'll also mock or use a simple Tree if needed.

describe('SwaggerAssembler', () => {
  it('should generate openapi for programmatic router', () => {
    const router = createRouter('/v1');
    
    router.get('/users', () => {}).meta({
      summary: 'List users',
      tags: ['Users']
    });

    router.post('/users/:id', () => {}).meta({
      summary: 'Update user',
      tags: ['Users'],
      responses: {
        200: { description: 'Updated' }
      }
    });

    const spec = SwaggerAssembler.generate(router, { title: 'Test API' });

    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBe('Test API');
    expect(spec.paths['/v1/users']).toBeDefined();
    expect(spec.paths['/v1/users']['get'].summary).toBe('List users');
    expect(spec.paths['/v1/users/{id}']).toBeDefined();
    expect(spec.paths['/v1/users/{id}']['post'].parameters).toContainEqual(expect.objectContaining({
      name: 'id',
      in: 'path'
    }));
  });

  it('should filter by namespace', () => {
    const router = createRouter();
    
    router.get('/admin/config', () => {}).meta({ namespace: 'admin', summary: 'Admin Config' });
    router.get('/public/info', () => {}).meta({ namespace: 'public', summary: 'Public Info' });

    const adminSpec = SwaggerAssembler.generate(router, { namespace: 'admin' });
    const publicSpec = SwaggerAssembler.generate(router, { namespace: 'public' });

    expect(Object.keys(adminSpec.paths)).toHaveLength(1);
    expect(adminSpec.paths['/admin/config']).toBeDefined();
    
    expect(Object.keys(publicSpec.paths)).toHaveLength(1);
    expect(publicSpec.paths['/public/info']).toBeDefined();
  });
});
