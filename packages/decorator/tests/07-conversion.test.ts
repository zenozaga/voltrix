import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  VoltrixApp,
  Module,
  Controller,
  Post,
  Body,
  createApplication
} from '../src/index';

@Controller('/convert')
class ConvertController {
  @Post('/transform')
  async transform(
    @Body({ transform: (data: any) => ({ ...data, transformed: true }) }) body: any
  ) {
    return body;
  }

  @Post('/schema')
  async withSchema(@Body({ schema: 'my-schema' }) body: any) {
    return body;
  }
}

@Module({
  controllers: [ConvertController]
})
class TestModule { }

@VoltrixApp({
  name: 'ConvertApp',
  modules: [TestModule],
  port: 9010
})
class App { }

describe('07-conversion.test.ts - Parameter Conversion and Transformation', () => {
  let application: any;
  let baseUrl = 'http://127.0.0.1:9010/convert';

  beforeAll(async () => {
    const { app } = await createApplication(App);
    application = app;

    // Set a global transformer for the schema test
    app.useTransformer(({ schema, data }: any) => {
      if (schema === 'my-schema') {
        return { ...data, validated: true };
      }
      return data;
    });

    await app.listen(9010);
  });

  afterAll(async () => {
    if (application) {
      await application.close();
      await new Promise(r => setTimeout(r, 100));
    }
  });

  it('should apply custom transform at parameter level', async () => {
    const res = await fetch(`${baseUrl}/transform`, {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
      headers: { 'Content-Type': 'application/json' }
    });
    const body: any = await res.json();
    expect(body.transformed).toBe(true);
    expect(body.foo).toBe('bar');
  });

  it('should apply global transformer via schema property', async () => {
    const res = await fetch(`${baseUrl}/schema`, {
      method: 'POST',
      body: JSON.stringify({ test: 123 }),
      headers: { 'Content-Type': 'application/json' }
    });
    const body: any = await res.json();
    expect(body.validated).toBe(true);
    expect(body.test).toBe(123);
  });
});
