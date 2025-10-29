/**
 * Example usage of @voltrix/mock
 */

import { voltrix } from '@voltrix/express';
import { createMockRouter, mockData, createRESTAPI } from './src/index.js';

// Create Voltrix app
const app = voltrix();

// Example 1: Simple mock router
const simpleAPI = createMockRouter({ 
  prefix: '/api',
  logging: true,
  cors: true 
});

simpleAPI
  .get('/hello', { 
    body: { message: 'Hello from Voltrix Mock!' }
  })
  .get('/users', { 
    body: () => mockData.users(10)
  })
  .get('/users/:id', {
    body: (req: any) => {
      const users = mockData.users(50);
      return users.find((u: any) => u.id === parseInt(req.params?.id || '1')) || { error: 'User not found' };
    }
  })
  .post('/users', {
    status: 201,
    body: (req: any) => ({
      ...req.body,
      id: Date.now(),
      createdAt: new Date().toISOString()
    })
  });

// Example 2: Full REST API
const restAPI = createRESTAPI({
  prefix: '/api/v1',
  logging: true,
  cors: true
});

// Mount the routers
app.use(simpleAPI.getRouter());
app.use(restAPI.getRouter());

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Voltrix Mock API running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('📍 GET  /api/hello');
  console.log('📍 GET  /api/users');
  console.log('📍 GET  /api/users/:id');
  console.log('📍 POST /api/users');
  console.log('📍 GET  /api/v1/users');
  console.log('📍 GET  /api/v1/products');
  console.log('📍 GET  /api/v1/posts');
  console.log('📍 GET  /api/v1/orders');
  console.log('📍 GET  /api/v1/companies');
});

export default app;