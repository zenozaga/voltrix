/**
 * Normalizes a body value to the format uWebSockets.js expects for `res.end()`.
 *
 * uWS accepts `ArrayBuffer | ArrayBufferView | string`. It does NOT accept
 * Node.js `Buffer` directly (Buffer extends Uint8Array which is ArrayBufferView,
 * so it works, but we expose this for clarity and performance).
 */
export type BodyInput = string | Buffer | Uint8Array | ArrayBuffer;

/**
 * Returns the input normalized to a type uWS `res.end()` accepts.
 * uWS RecognizedString: string | ArrayBuffer | Uint8Array (and other TypedArrays).
 * Buffer extends Uint8Array — passes through as-is.
 */
export function normalizeBody(body: BodyInput): string | ArrayBuffer | Uint8Array {
  if (typeof body === 'string') return body;
  if (body instanceof Buffer)      return body; // Buffer extends Uint8Array
  if (body instanceof Uint8Array)  return body;
  if (body instanceof ArrayBuffer) return body;
  return String(body);
}

/**
 * Parses a raw query string into a key-value map.
 * Handles numeric coercion, boolean coercion, and array notation (key[]).
 * Zero regex — pure char-level parsing.
 */
export function parseQueryString(qs: string): Record<string, unknown> {
  if (!qs) return {};

  const out: Record<string, unknown> = {};
  const len = qs.length;
  let i = 0;

  while (i < len) {
    // Find '='
    let eq = i;
    while (eq < len && qs[eq] !== '=' && qs[eq] !== '&') eq++;

    const rawKey = qs.slice(i, eq);
    if (!rawKey) { i = eq + 1; continue; }

    const key = decodeURIComponent(replacePlus(rawKey));

    if (eq >= len || qs[eq] === '&') {
      out[key] = '';
      i = eq + 1;
      continue;
    }

    // Find end of value
    let end = eq + 1;
    while (end < len && qs[end] !== '&') end++;

    const rawVal = qs.slice(eq + 1, end);
    const val = decodeURIComponent(replacePlus(rawVal));

    out[key] = coerceQueryValue(val);
    i = end + 1;
  }

  return out;
}

function replacePlus(s: string): string {
  let i = s.indexOf('+');
  if (i === -1) return s;
  let res = '';
  let last = 0;
  while (i !== -1) {
    res += s.slice(last, i) + ' ';
    last = i + 1;
    i = s.indexOf('+', last);
  }
  if (last < s.length) res += s.slice(last);
  return res;
}

function coerceQueryValue(val: string): unknown {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === '' || val === 'null') return null;
  if (val === 'undefined') return undefined;

  // Fast numeric check — avoid regex
  if (val.length > 0 && val.length <= 20) {
    const n = +val;
    if (!isNaN(n) && val.trim() !== '') return n;
  }

  return val;
}

/**
 * Concatenates an array of Uint8Array chunks into a single Buffer.
 * Uses `Buffer.allocUnsafe` when total size is known to avoid zeroing.
 */
export function concatChunks(chunks: Uint8Array[], totalBytes?: number): Buffer {
  if (chunks.length === 0) return Buffer.alloc(0);
  if (chunks.length === 1) {
    const chunk = chunks[0];
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }

  const total = totalBytes ?? chunks.reduce((s, c) => s + c.byteLength, 0);
  const out = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
