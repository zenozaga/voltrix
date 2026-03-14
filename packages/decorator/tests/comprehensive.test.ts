import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Get,
  Post,
  Query,
  Body,
  Middleware,
  createApplication,
  Inject,
  Scope
} from '../src/index';
import { Injectable } from '@voltrix/injector';

@Injectable()
class OrderService {
  async process(orderId: string) {
    return { orderId, status: 'processed', timestamp: Date.now() };
  }
}

const authMiddleware = (req: any, res: any, next: any) => {
  const userJson = req.header('x-test-user');
  if (userJson) req.user = JSON.parse(userJson);
  next();
};

@Controller('/orders')
class OrderController {
  constructor(@Inject(OrderService) private service: OrderService) {}

  @Post('/:id/pay')
  @Scope('finance:write')
  async pay(@Query('method') method: string, @Body() details: any) {
    const orderId = '123'; // Simulating ID from route or similar
    const result = await this.service.process(orderId);
    return { ...result, method, details };
  }
}

@Module({
  controllers: [OrderController],
  providers: [OrderService]
})
class BusinessModule {}

@VoltrixApp({
  name: 'E2EFlowApp',
  modules: [BusinessModule],
  middlewares: [authMiddleware],
  port: 9999
})
class App {}

describe('comprehensive.test.ts - High-Level E2E Flow', () => {
  let application: any;
  let baseUrl = 'http://127.0.0.1:9999';

  beforeAll(async () => {
    const { app } = await createApplication(App);
    application = app;
    await app.listen(9999);
  });

  afterAll(async () => {
    if (application) {
      await application.close();
      await new Promise(r => setTimeout(r, 100));
    }
  });

  it('should execute a complex flow: Auth -> Scope -> Service -> Result', async () => {
    const user = { scopes: ['finance:*'], roles: [] };
    const orderDetails = { amount: 100, currency: 'USD' };

    const res = await fetch(`${baseUrl}/orders/123/pay?method=stripe`, {
      method: 'POST',
      body: JSON.stringify(orderDetails),
      headers: {
        'x-test-user': JSON.stringify(user),
        'Content-Type': 'application/json'
      }
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    
    expect(body.status).toBe('processed');
    expect(body.method).toBe('stripe');
    expect(body.details).toEqual(orderDetails);
  });
});
