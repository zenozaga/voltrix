import type { JobPayload, JobTransformation } from '../types/index.js';

/**
 * ⚡ Voltrix Binary Protocol (VBP) Encoder/Decoder
 * A custom byte-aligned serialization protocol optimized for zero-copy binary transmissions.
 * Uses a 44-byte fixed-size header followed by variable-length UTF-8 / raw segments.
 * Fully backward-compatible with standard JSON string payloads using a Magic Prefix check.
 */

const MAGIC_PREFIX = 0x564C5458; // 'VLTX' in hex

/**
 * Serializes a JobPayload into a binary Buffer using VBP format
 */
export function serializeVbp(payload: JobPayload): Buffer {
  const isBinary = Buffer.isBuffer(payload.data);
  const dataType = isBinary ? 2 : 1;
  
  const dataBuf = isBinary 
    ? (payload.data as Buffer) 
    : Buffer.from(JSON.stringify(payload.data ?? null), 'utf-8');

  const uniqueIdBuf = Buffer.from(payload.uniqueId ?? '', 'utf-8');
  const cronBuf = Buffer.from(payload.cron ?? '', 'utf-8');
  const cronOptsBuf = Buffer.from(payload.cronOptions ? JSON.stringify(payload.cronOptions) : '', 'utf-8');
  const transBuf = Buffer.from(payload.transformations ? JSON.stringify(payload.transformations) : '', 'utf-8');
  const corrBuf = Buffer.from(payload.correlationId ?? '', 'utf-8');

  // Total buffer length: 44 (Header) + variable segments
  const totalLength = 
    44 + 
    uniqueIdBuf.length + 
    cronBuf.length + 
    cronOptsBuf.length + 
    transBuf.length + 
    corrBuf.length +
    dataBuf.length;

  const buf = Buffer.allocUnsafe(totalLength);

  // 1. Write Header (44 bytes)
  buf.writeUInt32BE(MAGIC_PREFIX, 0); // Magic 'VLTX'
  buf.writeUInt8(1, 4); // Version
  buf.writeUInt8(payload.backoffType === 'exponential' ? 2 : 1, 5);
  buf.writeUInt32BE(payload.backoffDelay ?? 1000, 6);
  buf.writeUInt32BE(payload.maxAttempts ?? 1, 10);
  buf.writeUInt32BE(payload.attempts ?? 0, 14);

  // Bit flags: bit 0 = removeOnComplete, bit 1 = removeOnFail
  let flags = 0;
  if (payload.removeOnComplete !== false) flags |= 1;
  if (payload.removeOnFail === true) flags |= 2;
  buf.writeUInt8(flags, 18);

  buf.writeUInt8(dataType, 19);
  buf.writeUInt32BE(uniqueIdBuf.length, 20);
  buf.writeUInt32BE(cronBuf.length, 24);
  buf.writeUInt32BE(cronOptsBuf.length, 28);
  buf.writeUInt32BE(transBuf.length, 32);
  buf.writeUInt32BE(corrBuf.length, 36);
  buf.writeUInt32BE(dataBuf.length, 40);

  // 2. Write Variable segments sequentially using Buffer.copy
  let offset = 44;

  uniqueIdBuf.copy(buf, offset);
  offset += uniqueIdBuf.length;

  cronBuf.copy(buf, offset);
  offset += cronBuf.length;

  cronOptsBuf.copy(buf, offset);
  offset += cronOptsBuf.length;

  transBuf.copy(buf, offset);
  offset += transBuf.length;

  corrBuf.copy(buf, offset);
  offset += corrBuf.length;

  dataBuf.copy(buf, offset);

  return buf;
}

/**
 * Deserializes a binary Buffer into a structured JobPayload.
 * Automatically falls back to standard JSON parsing if the Buffer is a legacy JSON string.
 */
export function deserializeVbp(buf: Buffer): JobPayload {
  // Guard: Must be at least 44 bytes and start with 'VLTX' magic prefix to be a binary payload
  if (buf.length < 44 || buf.readUInt32BE(0) !== MAGIC_PREFIX) {
    // Backward Compatibility Fallback: Parse as standard legacy UTF-8 JSON string
    return JSON.parse(buf.toString('utf-8')) as JobPayload;
  }

  const version = buf.readUInt8(4);
  if (version !== 1) {
    throw new Error(`Unsupported Voltrix Binary Protocol (VBP) version: ${version}`);
  }

  const backoffType = buf.readUInt8(5) === 2 ? 'exponential' : 'linear';
  const backoffDelay = buf.readUInt32BE(6);
  const maxAttempts = buf.readUInt32BE(10);
  const attempts = buf.readUInt32BE(14);

  const flags = buf.readUInt8(18);
  const removeOnComplete = (flags & 1) !== 0;
  const removeOnFail = (flags & 2) !== 0;

  const dataType = buf.readUInt8(19);
  const uniqueIdLen = buf.readUInt32BE(20);
  const cronLen = buf.readUInt32BE(24);
  const cronOptsLen = buf.readUInt32BE(28);
  const transLen = buf.readUInt32BE(32);
  const corrLen = buf.readUInt32BE(36);
  const dataLen = buf.readUInt32BE(40);

  // Zero-copy memory slicing using buffer.subarray
  let offset = 44;

  const uniqueId = uniqueIdLen > 0 ? buf.toString('utf-8', offset, offset + uniqueIdLen) : undefined;
  offset += uniqueIdLen;

  const cron = cronLen > 0 ? buf.toString('utf-8', offset, offset + cronLen) : undefined;
  offset += cronLen;

  const cronOptions = cronOptsLen > 0 
    ? (JSON.parse(buf.toString('utf-8', offset, offset + cronOptsLen)) as Record<string, unknown>) 
    : undefined;
  offset += cronOptsLen;

  const transformations = transLen > 0 
    ? (JSON.parse(buf.toString('utf-8', offset, offset + transLen)) as JobTransformation[]) 
    : undefined;
  offset += transLen;

  const correlationId = corrLen > 0 ? buf.toString('utf-8', offset, offset + corrLen) : undefined;
  offset += corrLen;

  const dataSegment = buf.subarray(offset, offset + dataLen);
  const data = dataType === 2 
    ? dataSegment // Return raw binary Buffer directly (zero-copy subarray)
    : JSON.parse(dataSegment.toString('utf-8'));

  return {
    data,
    attempts,
    maxAttempts,
    backoffType,
    backoffDelay,
    uniqueId,
    removeOnComplete,
    removeOnFail,
    cron,
    cronOptions,
    correlationId,
    transformations
  };
}
