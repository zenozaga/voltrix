import { describe, it, expect } from 'vitest';
import { JsonWriter } from '../src/serializers/json-writer.js';

describe('JsonWriter', () => {
  it('writes an empty object', () => {
    const w = new JsonWriter();
    w.objectStart().objectEnd();
    expect(w.toString()).toBe('{}');
  });

  it('writes a flat object with string, number, bool', () => {
    const w = new JsonWriter();
    w.objectStart()
      .key('name').string('Alice')
      .key('age').number(30)
      .key('active').bool(true)
      .key('score').number(9.5)
    .objectEnd();
    expect(JSON.parse(w.toString())).toEqual({ name: 'Alice', age: 30, active: true, score: 9.5 });
  });

  it('writes null', () => {
    const w = new JsonWriter();
    w.objectStart().key('x').null().objectEnd();
    expect(JSON.parse(w.toString())).toEqual({ x: null });
  });

  it('writes nested objects', () => {
    const w = new JsonWriter();
    w.objectStart()
      .key('user').objectStart()
        .key('id').number(1)
        .key('name').string('Bob')
      .objectEnd()
    .objectEnd();
    expect(JSON.parse(w.toString())).toEqual({ user: { id: 1, name: 'Bob' } });
  });

  it('writes an array of numbers', () => {
    const w = new JsonWriter();
    w.arrayStart()
      .number(1).number(2).number(3)
    .arrayEnd();
    expect(JSON.parse(w.toString())).toEqual([1, 2, 3]);
  });

  it('writes an array of strings', () => {
    const w = new JsonWriter();
    w.arrayStart().string('a').string('b').arrayEnd();
    expect(JSON.parse(w.toString())).toEqual(['a', 'b']);
  });

  it('escapes special characters in strings', () => {
    const w = new JsonWriter();
    w.objectStart()
      .key('msg').string('say "hello"\nworld\ttab')
    .objectEnd();
    const obj = JSON.parse(w.toString()) as { msg: string };
    expect(obj.msg).toBe('say "hello"\nworld\ttab');
  });

  it('handles unicode in strings', () => {
    const w = new JsonWriter();
    w.objectStart().key('emoji').string('🔥').objectEnd();
    const obj = JSON.parse(w.toString()) as { emoji: string };
    expect(obj.emoji).toBe('🔥');
  });

  it('resets correctly for reuse', () => {
    const w = new JsonWriter();
    w.objectStart().key('x').number(1).objectEnd();
    const first = w.toString();

    w.reset();
    w.objectStart().key('y').number(2).objectEnd();
    const second = w.toString();

    expect(first).toBe('{"x":1}');
    expect(second).toBe('{"y":2}');
  });

  it('uses value() for arbitrary nested data', () => {
    const w = new JsonWriter();
    const nested = { a: [1, 2], b: { c: true } };
    w.objectStart().key('data').value(nested).objectEnd();
    const result = JSON.parse(w.toString()) as { data: typeof nested };
    expect(result.data).toEqual(nested);
  });

  it('handles bool false correctly', () => {
    const w = new JsonWriter();
    w.objectStart().key('ok').bool(false).objectEnd();
    expect(JSON.parse(w.toString())).toEqual({ ok: false });
  });

  it('produces valid JSON for toBuffer()', () => {
    const w = new JsonWriter();
    w.objectStart().key('n').number(42).objectEnd();
    const buf = w.toBuffer();
    expect(JSON.parse(buf.toString('utf8'))).toEqual({ n: 42 });
  });
});
