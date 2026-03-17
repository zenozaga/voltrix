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
export function readBody(res: HttpResponse): Promise<Buffer> {
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
