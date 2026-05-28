import { describe, expect, it } from 'vitest';
import { serializeVbp, deserializeVbp } from '../src/utils/binary-protocol.js';
import type { JobPayload } from '../src/types/index.js';

describe('⚡ Voltrix Binary Protocol (VBP v1) Tests', () => {
  it('should support arbitrary custom correlation ID strings', () => {
    const payload: JobPayload = {
      correlationId: 'my-correlation-id',
      data: 'test'
    };
    const bytes = serializeVbp(payload);
    const decoded = deserializeVbp(bytes);
    expect(decoded.correlationId).toBe('my-correlation-id');
  });

  it('should serialize and deserialize a JobPayload containing structured JSON data', () => {
    const payload: JobPayload = {
      data: { hello: 'world', nested: { val: 42 } },
      attempts: 0,
      maxAttempts: 3,
      backoffType: 'exponential',
      backoffDelay: 2000,
      uniqueId: 'lock:test:123',
      removeOnComplete: true,
      removeOnFail: false,
      cron: '*/5 * * * *',
      cronOptions: { tz: 'UTC' },
      correlationId: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      transformations: [
        {
          pluginId: 'test-plugin',
          pluginName: 'TestPlugin',
          operation: 'test-op',
          timestamp: 123456789
        }
      ]
    };

    const buffer = serializeVbp(payload);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const decoded = deserializeVbp(buffer);
    expect(decoded.data).toEqual(payload.data);
    expect(decoded.maxAttempts).toBe(payload.maxAttempts);
    expect(decoded.backoffType).toBe(payload.backoffType);
    expect(decoded.backoffDelay).toBe(payload.backoffDelay);
    expect(decoded.uniqueId).toBe(payload.uniqueId);
    expect(decoded.removeOnComplete).toBe(payload.removeOnComplete);
    expect(decoded.removeOnFail).toBe(payload.removeOnFail);
    expect(decoded.cron).toBe(payload.cron);
    expect(decoded.cronOptions).toEqual(payload.cronOptions);
    expect(decoded.correlationId).toBe(payload.correlationId);
    expect(decoded.transformations).toEqual(payload.transformations);
  });

  it('should serialize and deserialize a JobPayload containing raw Buffer binary data', () => {
    const rawData = Buffer.from('voltrix-binary-raw-bytes-payload-file-data', 'utf-8');
    const payload: JobPayload = {
      data: rawData,
      attempts: 0,
      maxAttempts: 5,
      backoffType: 'linear',
      backoffDelay: 500,
      correlationId: '12345678-1234-1234-1234-123456789012'
    };

    const buffer = serializeVbp(payload);
    const decoded = deserializeVbp(buffer);

    expect(Buffer.isBuffer(decoded.data)).toBe(true);
    expect((decoded.data as Buffer).toString('utf-8')).toBe('voltrix-binary-raw-bytes-payload-file-data');
    expect(decoded.maxAttempts).toBe(5);
    expect(decoded.backoffType).toBe('linear');
    expect(decoded.backoffDelay).toBe(500);
    expect(decoded.correlationId).toBe('12345678-1234-1234-1234-123456789012');
  });

  it('should fallback perfectly and decode legacy pure JSON string payloads (Backward Compatibility)', () => {
    const legacyPayload = {
      data: { legacy: true },
      attempts: 2,
      maxAttempts: 10,
      backoffType: 'linear',
      backoffDelay: 1000,
      uniqueId: 'legacy-id-123',
      removeOnComplete: false,
      removeOnFail: true,
      correlationId: 'legacy-corr-id'
    };

    const legacyString = JSON.stringify(legacyPayload);
    const legacyBuffer = Buffer.from(legacyString, 'utf-8');

    // Deserializing a standard JSON string as a Buffer should fallback seamlessly
    const decoded = deserializeVbp(legacyBuffer);

    expect(decoded.data).toEqual(legacyPayload.data);
    expect(decoded.maxAttempts).toBe(legacyPayload.maxAttempts);
    expect(decoded.backoffType).toBe(legacyPayload.backoffType);
    expect(decoded.backoffDelay).toBe(legacyPayload.backoffDelay);
    expect(decoded.uniqueId).toBe(legacyPayload.uniqueId);
    expect(decoded.removeOnComplete).toBe(legacyPayload.removeOnComplete);
    expect(decoded.removeOnFail).toBe(legacyPayload.removeOnFail);
    expect(decoded.correlationId).toBe(legacyPayload.correlationId);
  });
});
