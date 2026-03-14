import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  Header,
  createApplication
} from '../src/index';

class User {
  constructor(public name: string, public age: number) { }
}

@Controller('/params')
class ParamsController {
  @Get('/query')
  async getQuery(@Query('name') name: string) {
    return { name };
  }

  @Post('/body')
  async postBody(@Body(User) user: User) {
    return user;
  }

  @Get('/path/:id')
  async getParam(@Param('id') id: string) {
    return { id };
  }

  @Get('/header')
  async getHeader(@Header('user-agent') ua: string) {
    return { ua };
  }
}

@Module({
  controllers: [ParamsController]
})
class TestModule { }

@VoltrixApp({
  name: 'ParamsApp',
  modules: [TestModule],
  port: 9004
})
class App { }

describe('03-parameters.test.ts - Parameter Extraction', () => {
  let application: any;
  let baseUrl = 'http://127.0.0.1:9004/params';

  beforeAll(async () => {
    const { app } = await createApplication(App);
    application = app;
    await app.listen(9004);
  });

  afterAll(async () => {
    if (application) {
      await application.close();
      await new Promise(r => setTimeout(r, 100));
    }
  });

  it('should extract @Query', async () => {
    const res = await fetch(`${baseUrl}/query?name=Voltrix`);
    const body: any = await res.json();
    expect(body.name).toBe('Voltrix');
  });

  it('should extract @Body', async () => {
    const user = { name: 'John', age: 30 };
    const res = await fetch(`${baseUrl}/body`, {
      method: 'POST',
      body: JSON.stringify(user),
      headers: { 'Content-Type': 'application/json' }
    });
    const body: any = await res.json();
    expect(body).toEqual(user);
  });

  it('should extract @Param', async () => {
    const res = await fetch(`${baseUrl}/path/12345`);
    const body: any = await res.json();
    expect(body.id).toBe('12345');
  });

  it('should extract @Header', async () => {
    const res = await fetch(`${baseUrl}/header`, {
      headers: { 'user-agent': 'Voltrix-Agent' }
    });
    const body: any = await res.json();
    expect(body.ua).toBe('Voltrix-Agent');
  });
});
