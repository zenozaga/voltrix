export type BodyInput = string | ArrayBuffer | SharedArrayBuffer | Buffer | ArrayBufferView;

export type BodyOutput = string | ArrayBuffer | Uint8Array;

export function normalizeBodyForUWS(body: BodyInput): BodyOutput {
  // FAST PATH: strings → no tocar
  if (typeof body === 'string') {
    return body;
  }

  // FAST PATH: Buffer / Uint8Array (already zero-copy views or valid)
  if (body instanceof Uint8Array || body instanceof Buffer) {
    return body;
  }

  // SharedArrayBuffer → MUST convert (uWS does NOT accept SAB)
  if (body instanceof SharedArrayBuffer) {
    return new Uint8Array(body).slice();
  }

  // ArrayBuffer → valid
  if (body instanceof ArrayBuffer) {
    return body;
  }

  // ArrayBufferView (DataView, TypedArrays…)
  // Return a Uint8Array view of the same memory
  return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
}
