/**
 * 🚀 Voltrix Decorator Adapter
 * Adaptador para Voltrix usando Decoradores
 */

import 'reflect-metadata';
import { 
  VoltrixApp, 
  Module, 
  Controller, 
  Get, 
  Post, 
  Param, 
  Body, 
  createApplication 
} from '@voltrix/decorator';
import { FrameworkAdapter, STANDARD_RESPONSE } from '../framework-interface.js';

@Controller('/')
class RootController {
  @Get('/')
  async index() {
    return {
      ...STANDARD_RESPONSE,
      framework: 'Voltrix-Decorators',
      timestamp: Date.now(),
      decoratorOverhead: 'Measured'
    };
  }

  @Get('/ping')
  async ping() {
    return { 
      pong: true, 
      timestamp: Date.now(),
      framework: 'Voltrix-Decorators'
    };
  }

  @Get('/users/:id')
  async getUser(@Param('id') id) {
    return {
      id,
      name: 'Test User',
      framework: 'Voltrix-Decorators',
      params: { id }
    };
  }

  @Post('/users')
  async createUser(@Body() body) {
    return {
      id: Math.floor(Math.random() * 1000),
      message: 'User created',
      framework: 'Voltrix-Decorators',
      method: 'POST'
    };
  }
}

@Module({
  controllers: [RootController]
})
class BenchModule {}

@VoltrixApp({
  modules: [BenchModule]
})
class BenchApp {}

export class VoltrixDecoratorAdapter extends FrameworkAdapter {
  constructor() {
    super('Voltrix-Decorators', '1.0.0', 'uWebSockets.js + Decorators');
    this.app = null;
    this.voltrixInstance = null;
  }

  async start(port, config = {}) {
    // Note: createApplication is async and performs discovery
    const { app, listen } = await createApplication(BenchApp);
    this.voltrixInstance = app;
    
    // Middleware contador
    app.use((req, res, next) => {
      this.incrementRequestCount();
      next();
    });

    return listen(port);
  }

  async stop() {
    if (this.voltrixInstance) {
      await this.voltrixInstance.close();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  getInfo() {
    const baseInfo = super.getInfo();
    return {
      ...baseInfo,
      features: [
        'Decorator-based Routing',
        'Auto DI Container',
        'Tree discovery',
        'uWebSockets.js Backend'
      ]
    };
  }
}
