/**
 * JsonWriter — manual byte-level JSON builder for zero-overhead serialization.
 *
 * Writes directly into a pre-allocated Buffer using byte codes instead of
 * string concatenation. Reuse a single instance per request via reset().
 *
 * Designed for known-schema responses where the structure is fixed at startup.
 *
 * @example
 * ```ts
 * const w = new JsonWriter(256);
 * w.objectStart();
 *   w.key('id');   w.number(42);
 *   w.key('name'); w.string('Alice');
 *   w.key('ok');   w.bool(true);
 * w.objectEnd();
 * const result = w.toString(); // '{"id":42,"name":"Alice","ok":true}'
 * ```
 */
export class JsonWriter {
  private buf: Buffer;
  private pos = 0;
  private needsComma = false;
  private commaStack: boolean[] = [];

  constructor(initialCapacity = 512) {
    this.buf = Buffer.allocUnsafe(initialCapacity);
  }

  /** Reset to initial state for reuse. Does not reallocate. */
  reset(): this {
    this.pos = 0;
    this.needsComma = false;
    this.commaStack.length = 0;
    return this;
  }

  // ─── Output ──────────────────────────────────────────────────────────────

  /** Return written bytes as a UTF-8 string. */
  toString(): string {
    return this.buf.toString('utf8', 0, this.pos);
  }

  /** Return written bytes as a Buffer slice (zero-copy view). */
  toBuffer(): Buffer {
    return this.buf.subarray(0, this.pos);
  }

  /** Return written bytes as a Uint8Array (zero-copy view). */
  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buf.buffer, this.buf.byteOffset, this.pos);
  }

  // ─── Structure ───────────────────────────────────────────────────────────

  objectStart(): this {
    this.writeCommaIfNeeded();
    this.commaStack.push(this.needsComma);
    this.needsComma = false;
    this.writeByte(0x7b); // '{'
    return this;
  }

  objectEnd(): this {
    this.writeByte(0x7d); // '}'
    this.needsComma = this.commaStack.pop() ?? false;
    this.needsComma = true; // after closing, next sibling needs comma
    return this;
  }

  arrayStart(): this {
    this.writeCommaIfNeeded();
    this.commaStack.push(this.needsComma);
    this.needsComma = false;
    this.writeByte(0x5b); // '['
    return this;
  }

  arrayEnd(): this {
    this.writeByte(0x5d); // ']'
    this.commaStack.pop();
    this.needsComma = true;
    return this;
  }

  // ─── Object key ──────────────────────────────────────────────────────────

  /** Write a JSON object key (including the ':' separator). */
  key(name: string): this {
    this.writeCommaIfNeeded();
    this.needsComma = false; // key resets; value will set it
    this.writeStringRaw(name);
    this.writeByte(0x3a); // ':'
    return this;
  }

  // ─── Values ──────────────────────────────────────────────────────────────

  string(value: string): this {
    this.writeCommaIfNeeded();
    this.writeStringRaw(value);
    this.needsComma = true;
    return this;
  }

  number(value: number): this {
    this.writeCommaIfNeeded();
    this.writeAscii(String(value));
    this.needsComma = true;
    return this;
  }

  bool(value: boolean): this {
    this.writeCommaIfNeeded();
    if (value) {
      this.writeByte(0x74); this.writeByte(0x72); this.writeByte(0x75); this.writeByte(0x65); // true
    } else {
      this.writeByte(0x66); this.writeByte(0x61); this.writeByte(0x6c); this.writeByte(0x73); this.writeByte(0x65); // false
    }
    this.needsComma = true;
    return this;
  }

  null(): this {
    this.writeCommaIfNeeded();
    this.writeByte(0x6e); this.writeByte(0x75); this.writeByte(0x6c); this.writeByte(0x6c); // null
    this.needsComma = true;
    return this;
  }

  /**
   * Write any value using JSON.stringify fallback.
   * Use for nested objects where manual writing isn't worth it.
   */
  value(v: unknown): this {
    this.writeCommaIfNeeded();
    this.writeAscii(JSON.stringify(v) ?? 'null');
    this.needsComma = true;
    return this;
  }

  // ─── Internal write primitives ────────────────────────────────────────────

  private writeByte(byte: number): void {
    this.ensureCapacity(1);
    this.buf[this.pos++] = byte;
  }

  private writeAscii(s: string): void {
    const len = s.length;
    this.ensureCapacity(len);
    for (let i = 0; i < len; i++) {
      this.buf[this.pos++] = s.charCodeAt(i);
    }
  }

  private writeStringRaw(s: string): void {
    // Worst case: every char needs 6-byte unicode escape + wrapping quotes
    this.ensureCapacity(s.length * 6 + 2);
    this.buf[this.pos++] = 0x22; // '"'
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 0x22) { this.buf[this.pos++] = 0x5c; this.buf[this.pos++] = 0x22; }       // \"
      else if (c === 0x5c) { this.buf[this.pos++] = 0x5c; this.buf[this.pos++] = 0x5c; } // \\
      else if (c === 0x0a) { this.buf[this.pos++] = 0x5c; this.buf[this.pos++] = 0x6e; } // \n
      else if (c === 0x0d) { this.buf[this.pos++] = 0x5c; this.buf[this.pos++] = 0x72; } // \r
      else if (c === 0x09) { this.buf[this.pos++] = 0x5c; this.buf[this.pos++] = 0x74; } // \t
      else if (c < 0x20) {
        // Control characters — unicode escape
        const hex = c.toString(16).padStart(4, '0');
        this.buf[this.pos++] = 0x5c; this.buf[this.pos++] = 0x75;
        for (let j = 0; j < 4; j++) this.buf[this.pos++] = hex.charCodeAt(j);
      } else if (c < 0x80) {
        // ASCII fast path
        this.buf[this.pos++] = c;
      } else if (c >= 0xD800 && c <= 0xDBFF) {
        // High surrogate — combine with low surrogate for a 4-byte UTF-8 code point (emoji, etc.)
        const low = s.charCodeAt(++i);
        const cp  = 0x10000 + ((c - 0xD800) << 10) + (low - 0xDC00);
        this.buf[this.pos++] = 0xF0 | (cp >> 18);
        this.buf[this.pos++] = 0x80 | ((cp >> 12) & 0x3F);
        this.buf[this.pos++] = 0x80 | ((cp >> 6)  & 0x3F);
        this.buf[this.pos++] = 0x80 | (cp & 0x3F);
      } else if (c < 0x800) {
        // 2-byte UTF-8
        this.buf[this.pos++] = 0xC0 | (c >> 6);
        this.buf[this.pos++] = 0x80 | (c & 0x3F);
      } else {
        // 3-byte UTF-8
        this.buf[this.pos++] = 0xE0 | (c >> 12);
        this.buf[this.pos++] = 0x80 | ((c >> 6) & 0x3F);
        this.buf[this.pos++] = 0x80 | (c & 0x3F);
      }
    }
    this.buf[this.pos++] = 0x22; // '"'
  }

  private writeCommaIfNeeded(): void {
    if (this.needsComma) {
      this.writeByte(0x2c); // ','
    }
  }

  private ensureCapacity(needed: number): void {
    if (this.pos + needed <= this.buf.length) return;
    const newSize = Math.max(this.buf.length * 2, this.pos + needed + 64);
    const next = Buffer.allocUnsafe(newSize);
    this.buf.copy(next, 0, 0, this.pos);
    this.buf = next;
  }
}
