/**
 * Mock data generators for common use cases
 */

import type { DataSchema, MockDataGenerators } from '../types/index.js';

export class MockDataGenerator implements MockDataGenerators {
  private static getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]!;
  }

  private static getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private static generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private static generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private static generateEmail(): string {
    const domains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'example.com'];
    const names = ['user', 'admin', 'test', 'demo', 'john', 'jane', 'bob', 'alice'];
    const number = this.getRandomNumber(1, 999);
    return `${this.getRandomItem(names)}${number}@${this.getRandomItem(domains)}`;
  }

  private static generateName(): string {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 
                       'Robert', 'Maria', 'James', 'Patricia', 'William', 'Jennifer', 'Richard'];
    const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 
                      'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin'];
    return `${this.getRandomItem(firstNames)} ${this.getRandomItem(lastNames)}`;
  }

  private static generateCompanyName(): string {
    const prefixes = ['Tech', 'Data', 'Cloud', 'Smart', 'Digital', 'Cyber', 'Innovation', 'Future'];
    const suffixes = ['Corp', 'Inc', 'Ltd', 'Solutions', 'Systems', 'Labs', 'Works', 'Dynamics'];
    return `${this.getRandomItem(prefixes)}${this.getRandomItem(suffixes)}`;
  }

  private static generateProductName(): string {
    const adjectives = ['Premium', 'Professional', 'Advanced', 'Ultimate', 'Pro', 'Elite', 'Smart'];
    const products = ['Laptop', 'Phone', 'Tablet', 'Monitor', 'Keyboard', 'Mouse', 'Headphones', 
                     'Camera', 'Speaker', 'Watch', 'Charger', 'Cable'];
    return `${this.getRandomItem(adjectives)} ${this.getRandomItem(products)}`;
  }

  private static generateAddress(): string {
    const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Elm Dr', 'Cedar Ln', 'Maple Way'];
    const number = this.getRandomNumber(100, 9999);
    return `${number} ${this.getRandomItem(streets)}`;
  }

  private static generatePhone(): string {
    const areaCode = this.getRandomNumber(200, 999);
    const exchange = this.getRandomNumber(200, 999);
    const number = this.getRandomNumber(1000, 9999);
    return `(${areaCode}) ${exchange}-${number}`;
  }

  private static generateUrl(): string {
    const domains = ['example.com', 'test.org', 'demo.net', 'sample.io'];
    const paths = ['', '/home', '/about', '/products', '/contact', '/blog'];
    return `https://${this.getRandomItem(domains)}${this.getRandomItem(paths)}`;
  }

  users(count = 10): any[] {
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      uuid: MockDataGenerator.generateUuid(),
      name: MockDataGenerator.generateName(),
      username: `user${index + 1}`,
      email: MockDataGenerator.generateEmail(),
      age: MockDataGenerator.getRandomNumber(18, 65),
      role: MockDataGenerator.getRandomItem(['user', 'admin', 'moderator', 'guest']),
      active: Math.random() > 0.2,
      phone: MockDataGenerator.generatePhone(),
      address: MockDataGenerator.generateAddress(),
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${MockDataGenerator.generateId()}`,
      bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    }));
  }

  posts(count = 20): any[] {
    const titles = [
      'Getting Started with TypeScript',
      'Building Modern Web Applications', 
      'The Future of JavaScript',
      'Best Practices for API Design',
      'Understanding Microservices',
      'Introduction to Node.js',
      'React vs Vue: A Comparison',
      'Database Design Principles',
    ];

    const tags = ['tech', 'javascript', 'web', 'api', 'tutorial', 'nodejs', 'react', 'vue', 'database'];

    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      title: `${MockDataGenerator.getRandomItem(titles)} - Part ${index + 1}`,
      slug: `post-${index + 1}-${MockDataGenerator.generateId()}`,
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
      excerpt: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
      authorId: MockDataGenerator.getRandomNumber(1, 5),
      author: MockDataGenerator.generateName(),
      tags: Array.from({ length: MockDataGenerator.getRandomNumber(1, 4) }, () => 
        MockDataGenerator.getRandomItem(tags)
      ),
      published: Math.random() > 0.3,
      featured: Math.random() > 0.8,
      views: MockDataGenerator.getRandomNumber(0, 10000),
      likes: MockDataGenerator.getRandomNumber(0, 500),
      comments: MockDataGenerator.getRandomNumber(0, 50),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      image: `https://picsum.photos/800/400?random=${index + 1}`,
    }));
  }

  comments(count = 50): any[] {
    const sampleComments = [
      'Great post! Thanks for sharing.',
      'Very helpful, learned a lot.',
      'I disagree with some points but overall good.',
      'Could you explain more about this?',
      'Excellent tutorial!',
      'This helped me solve my problem.',
      'Looking forward to more content like this.',
      'Well written and easy to understand.',
    ];

    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      postId: MockDataGenerator.getRandomNumber(1, 20),
      parentId: Math.random() > 0.8 ? MockDataGenerator.getRandomNumber(1, index) : null,
      authorId: MockDataGenerator.getRandomNumber(1, 10),
      author: MockDataGenerator.generateName(),
      content: MockDataGenerator.getRandomItem(sampleComments),
      approved: Math.random() > 0.1,
      replies: MockDataGenerator.getRandomNumber(0, 5),
      likes: MockDataGenerator.getRandomNumber(0, 20),
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  }

  products(count = 30): any[] {
    const categories = ['electronics', 'computers', 'accessories', 'mobile', 'gaming', 'audio'];
    const brands = ['TechBrand', 'SmartCorp', 'InnovateCo', 'ProTech', 'EliteGear'];

    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      sku: `PRD-${String(index + 1).padStart(4, '0')}`,
      name: MockDataGenerator.generateProductName(),
      description: 'High-quality product with excellent features and modern design. Perfect for professionals and enthusiasts alike.',
      price: MockDataGenerator.getRandomNumber(10, 2000),
      originalPrice: function() { return this.price + MockDataGenerator.getRandomNumber(0, 500); },
      category: MockDataGenerator.getRandomItem(categories),
      brand: MockDataGenerator.getRandomItem(brands),
      inStock: Math.random() > 0.1,
      stock: MockDataGenerator.getRandomNumber(0, 100),
      rating: Number((Math.random() * 2 + 3).toFixed(1)), // 3.0 - 5.0
      reviews: MockDataGenerator.getRandomNumber(0, 200),
      features: Array.from({ length: MockDataGenerator.getRandomNumber(3, 6) }, (_, i) => 
        `Feature ${i + 1}: Advanced technology and premium materials`
      ),
      specifications: {
        weight: `${MockDataGenerator.getRandomNumber(100, 5000)}g`,
        dimensions: `${MockDataGenerator.getRandomNumber(10, 50)}x${MockDataGenerator.getRandomNumber(10, 30)}x${MockDataGenerator.getRandomNumber(1, 10)}cm`,
        warranty: `${MockDataGenerator.getRandomNumber(1, 3)} years`,
      },
      images: [
        `https://picsum.photos/600/400?random=${index + 1}`,
        `https://picsum.photos/600/400?random=${index + 100}`,
        `https://picsum.photos/600/400?random=${index + 200}`,
      ],
      createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  }

  orders(count = 25): any[] {
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    const paymentMethods = ['credit_card', 'paypal', 'bank_transfer', 'cash_on_delivery'];
    
    return Array.from({ length: count }, (_, index) => {
      const itemsCount = MockDataGenerator.getRandomNumber(1, 5);
      const items = Array.from({ length: itemsCount }, (_, i) => {
        const quantity = MockDataGenerator.getRandomNumber(1, 3);
        const price = MockDataGenerator.getRandomNumber(10, 500);
        return {
          id: i + 1,
          productId: MockDataGenerator.getRandomNumber(1, 30),
          name: MockDataGenerator.generateProductName(),
          quantity,
          unitPrice: price,
          totalPrice: quantity * price,
          sku: `PRD-${MockDataGenerator.getRandomNumber(1000, 9999)}`,
        };
      });
      
      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const tax = Math.round(subtotal * 0.1);
      const shipping = MockDataGenerator.getRandomNumber(0, 25);
      
      return {
        id: index + 1,
        orderNumber: `ORD-${Date.now()}-${String(index + 1).padStart(3, '0')}`,
        customerId: MockDataGenerator.getRandomNumber(1, 10),
        customerName: MockDataGenerator.generateName(),
        customerEmail: MockDataGenerator.generateEmail(),
        items,
        subtotal,
        tax,
        shipping,
        total: subtotal + tax + shipping,
        status: MockDataGenerator.getRandomItem(statuses),
        paymentMethod: MockDataGenerator.getRandomItem(paymentMethods),
        paymentStatus: Math.random() > 0.2 ? 'paid' : 'pending',
        shippingAddress: {
          street: MockDataGenerator.generateAddress(),
          city: MockDataGenerator.getRandomItem(['New York', 'Los Angeles', 'Chicago', 'Houston']),
          state: MockDataGenerator.getRandomItem(['NY', 'CA', 'IL', 'TX']),
          zipCode: String(MockDataGenerator.getRandomNumber(10000, 99999)),
          country: 'USA',
        },
        trackingNumber: Math.random() > 0.5 ? `TRK${MockDataGenerator.getRandomNumber(100000, 999999)}` : null,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    });
  }

  companies(count = 15): any[] {
    const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing'];
    const sizes = ['startup', 'small', 'medium', 'large', 'enterprise'];

    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      name: MockDataGenerator.generateCompanyName(),
      slug: `company-${index + 1}`,
      description: 'A leading company providing innovative solutions and exceptional services to clients worldwide.',
      industry: MockDataGenerator.getRandomItem(industries),
      size: MockDataGenerator.getRandomItem(sizes),
      employees: MockDataGenerator.getRandomNumber(10, 10000),
      founded: MockDataGenerator.getRandomNumber(1950, 2020),
      website: MockDataGenerator.generateUrl(),
      email: MockDataGenerator.generateEmail(),
      phone: MockDataGenerator.generatePhone(),
      address: {
        street: MockDataGenerator.generateAddress(),
        city: MockDataGenerator.getRandomItem(['New York', 'San Francisco', 'Boston', 'Austin']),
        state: MockDataGenerator.getRandomItem(['NY', 'CA', 'MA', 'TX']),
        zipCode: String(MockDataGenerator.getRandomNumber(10000, 99999)),
        country: 'USA',
      },
      revenue: MockDataGenerator.getRandomNumber(100000, 50000000),
      logo: `https://api.dicebear.com/7.x/identicon/svg?seed=${MockDataGenerator.generateId()}`,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  }

  custom(schema: DataSchema, count = 10): any[] {
    return Array.from({ length: count }, (_, index) => {
      const item: any = { id: index + 1 };
      
      for (const [key, type] of Object.entries(schema)) {
        if (typeof type === 'function') {
          item[key] = type(index);
        } else {
          switch (type) {
            case 'string':
              item[key] = `${key}_${index + 1}`;
              break;
            case 'number':
              item[key] = MockDataGenerator.getRandomNumber(1, 100);
              break;
            case 'boolean':
              item[key] = Math.random() > 0.5;
              break;
            case 'email':
              item[key] = MockDataGenerator.generateEmail();
              break;
            case 'name':
              item[key] = MockDataGenerator.generateName();
              break;
            case 'date':
              item[key] = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
              break;
            case 'uuid':
              item[key] = MockDataGenerator.generateUuid();
              break;
            case 'url':
              item[key] = MockDataGenerator.generateUrl();
              break;
            case 'phone':
              item[key] = MockDataGenerator.generatePhone();
              break;
            case 'address':
              item[key] = MockDataGenerator.generateAddress();
              break;
            default:
              item[key] = `${type}_${index + 1}`;
          }
        }
      }
      
      return item;
    });
  }
}