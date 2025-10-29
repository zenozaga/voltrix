import { describe, it, expect } from 'vitest';
import { mockData, MockDataGenerator } from '../src/generators/index.js';

describe('@voltrix/mock Integration Tests', () => {
  describe('Package Exports', () => {
    it('should export mockData singleton', () => {
      expect(mockData).toBeDefined();
      expect(mockData).toBeInstanceOf(MockDataGenerator);
      expect(typeof mockData.users).toBe('function');
      expect(typeof mockData.products).toBe('function');
    });

    it('should export MockDataGenerator class', () => {
      expect(MockDataGenerator).toBeDefined();
      const generator = new MockDataGenerator();
      expect(generator).toBeInstanceOf(MockDataGenerator);
    });
  });

  describe('mockData singleton', () => {
    it('should provide access to data generators', () => {
      expect(mockData).toBeDefined();
      expect(typeof mockData.users).toBe('function');
      expect(typeof mockData.products).toBe('function');
      expect(typeof mockData.posts).toBe('function');
      expect(typeof mockData.orders).toBe('function');
      expect(typeof mockData.companies).toBe('function');
      expect(typeof mockData.custom).toBe('function');
    });

    it('should generate consistent data', () => {
      const users1 = mockData.users(5);
      const users2 = mockData.users(5);
      
      expect(users1).toHaveLength(5);
      expect(users2).toHaveLength(5);
      
      // Structure should be consistent
      expect(users1[0]).toHaveProperty('id');
      expect(users1[0]).toHaveProperty('name');
      expect(users1[0]).toHaveProperty('email');
    });
  });

  describe('Data Generation Scenarios', () => {
    it('should handle e-commerce scenario', () => {
      const products = mockData.products(10);
      const orders = mockData.orders(5);
      const users = mockData.users(15);

      expect(products).toHaveLength(10);
      expect(orders).toHaveLength(5);
      expect(users).toHaveLength(15);

      // Validate e-commerce structure
      expect(products[0]).toHaveProperty('price');
      expect(products[0]).toHaveProperty('category');
      expect(orders[0]).toHaveProperty('total');
      expect(orders[0]).toHaveProperty('items');
      expect(Array.isArray(orders[0].items)).toBe(true);
    });

    it('should handle blog scenario', () => {
      const posts = mockData.posts(8);
      const comments = mockData.comments(20);
      const users = mockData.users(5);

      expect(posts).toHaveLength(8);
      expect(comments).toHaveLength(20);
      expect(users).toHaveLength(5);

      // Validate blog structure
      expect(posts[0]).toHaveProperty('title');
      expect(posts[0]).toHaveProperty('content');
      expect(posts[0]).toHaveProperty('published');
      expect(comments[0]).toHaveProperty('postId');
      expect(comments[0]).toHaveProperty('content');
    });
  });

  describe('Custom Data Generation', () => {
    it('should generate custom structured data', () => {
      const customSchema = {
        projectName: 'string' as const,
        priority: 'number' as const,
        completed: 'boolean' as const,
        assignee: 'email' as const,
        deadline: 'date' as const
      };

      const projects = mockData.custom(customSchema, 5);
      
      expect(projects).toHaveLength(5);
      
      const project = projects[0];
      expect(typeof project.projectName).toBe('string');
      expect(typeof project.priority).toBe('number');
      expect(typeof project.completed).toBe('boolean');
      expect(typeof project.assignee).toBe('string');
      expect(project.assignee).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(project.deadline).toBeInstanceOf(Date);
    });
  });
});