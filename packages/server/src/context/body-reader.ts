import type { HttpResponse } from 'uWebSockets.js';
import { concatChunks } from '../common/normalize.js';

/**
 * Reads the full request body from a uWS HttpResponse.
 *
 * uWS delivers body as streaming `onData` chunks. We accumulate them
 * synchronously (uWS calls onData on the same tick for small bodies),
 * then resolve on the last chunk.
 *
 * The returned Promise resolves with the concatenated Buffer, or rejects
 * if the connection is aborted before the body is complete.
 *
 * @internal — called once per request when the body is first accessed.
 */
export function readBody(res: HttpResponse, expectedLength?: number): Promise<Buffer> {
  if (expectedLength !== undefined && Number.isInteger(expectedLength) && expectedLength >= 0) {
    return readBodyWithKnownLength(res, expectedLength);
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];

    res.onAborted(() => {
      reject(new Error('Request aborted before body was fully read'));
    });

    res.onData((ab: ArrayBuffer, isLast: boolean) => {
      // uWS reuses the ArrayBuffer — copy immediately
      const chunk = new Uint8Array(ab.byteLength);
      chunk.set(new Uint8Array(ab));
      chunks.push(chunk);

      if (isLast) {
        resolve(concatChunks(chunks));
      }
    });
  });
}

function readBodyWithKnownLength(res: HttpResponse, expectedLength: number): Promise<Buffer> {
  if (expectedLength === 0) {
    return Promise.resolve(Buffer.alloc(0));
  }

  return new Promise<Buffer>((resolve, reject) => {
    const buffer = Buffer.allocUnsafe(expectedLength);
    let offset = 0;

    res.onAborted(() => {
      reject(new Error('Request aborted before body was fully read'));
    });

    res.onData((ab: ArrayBuffer, isLast: boolean) => {
      const chunk = new Uint8Array(ab);
      buffer.set(chunk, offset);
      offset += chunk.byteLength;

      if (isLast) {
        resolve(offset === expectedLength ? buffer : buffer.subarray(0, offset));
      }
    });
  });
}
