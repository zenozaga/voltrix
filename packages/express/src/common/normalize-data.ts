export type BodyInput = string | ArrayBuffer | SharedArrayBuffer | Buffer | ArrayBufferView;

export function normalizeBodyForUWS(body: BodyInput): string | ArrayBuffer {
  // FAST PATH: strings → no tocar
  if (typeof body === 'string') {
    return body;
  }

  // Buffer → ArrayBuffer slice (zero-copy view)
  if (body instanceof Buffer) {
    return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  }

  // SharedArrayBuffer → MUST convert (uWS does NOT accept SAB)
  if (body instanceof SharedArrayBuffer) {
    const tmp = new Uint8Array(body);
    return tmp.slice().buffer as ArrayBuffer;
  }

  // ArrayBuffer → already valid
  if (body instanceof ArrayBuffer) {
    return body;
  }

  // ArrayBufferView (Uint8Array, DataView, TypedArrays…)
  // MUST copy because .buffer may be SAB or oversized
  const view = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  return view.slice().buffer as ArrayBuffer;
}
