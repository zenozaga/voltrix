import { describe, it, expect } from 'vitest';
import { MockDataGenerator } from '../src/generators/MockDataGenerator.js';

describe('MockDataGenerator', () => {
  const generator = new MockDataGenerator();

  describe('users generation', () => {
    it('should generate the correct number of users', () => {
      const users = generator.users(5);
      expect(users).toHaveLength(5);
    });

    it('should generate users with required fields', () => {
      const users = generator.users(1);
      const user = users[0];
      
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('createdAt');
      expect(typeof user.id).toBe('number');
      expect(typeof user.name).toBe('string');
      expect(typeof user.email).toBe('string');
      expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });

  describe('products generation', () => {
    it('should generate the correct number of products', () => {
      const products = generator.products(3);
      expect(products).toHaveLength(3);
    });

    it('should generate products with valid price ranges', () => {
      const products = generator.products(10);
      products.forEach((product: any) => {
        expect(product.price).toBeGreaterThan(0);
        expect(product.price).toBeLessThan(2500);
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('category');
        expect(product).toHaveProperty('description');
      });
    });
  });

  describe('custom schema generation', () => {
    it('should generate data based on custom schema', () => {
      const schema = {
        title: 'string' as const,
        count: 'number' as const,
        active: 'boolean' as const,
        email: 'email' as const,
        createdAt: 'date' as const
      };
      
      const data = generator.custom(schema, 2);
      expect(data).toHaveLength(2);
      
      const item = data[0];
      expect(typeof item.title).toBe('string');
      expect(typeof item.count).toBe('number');
      expect(typeof item.active).toBe('boolean');
      expect(typeof item.email).toBe('string');
      expect(item.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(item.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('posts generation', () => {
    it('should generate posts with valid structure', () => {
      const posts = generator.posts(2);
      expect(posts).toHaveLength(2);
      
      const post = posts[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('content');
      expect(post).toHaveProperty('authorId');
      expect(post).toHaveProperty('createdAt');
      expect(post).toHaveProperty('published');
      expect(typeof post.published).toBe('boolean');
    });
  });

  describe('orders generation', () => {
    it('should generate orders with valid totals', () => {
      const orders = generator.orders(3);
      expect(orders).toHaveLength(3);
      
      orders.forEach((order: any) => {
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('customerId');
        expect(order).toHaveProperty('total');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('items');
        expect(Array.isArray(order.items)).toBe(true);
        expect(order.total).toBeGreaterThan(0);
        expect(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).toContain(order.status);
      });
    });
  });
});