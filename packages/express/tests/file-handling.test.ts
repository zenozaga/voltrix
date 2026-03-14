import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { voltrix } from '../src/index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

describe('File Handling (Send & Receive)', () => {
  const app = voltrix();
  const testDir = path.join(tmpdir(), 'voltrix-test-' + Date.now());
  const largeFilePath = path.join(testDir, 'large.bin');
  const largeFileSize = 10 * 1024 * 1024; // 10MB

  beforeAll(async () => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
    // Create a 10MB dummy file
    const buf = Buffer.alloc(largeFileSize, 'v');
    fs.writeFileSync(largeFilePath, buf);
    
    app.get('/download', async (req, res) => {
      await res.sendFile(largeFilePath);
    });

    app.post('/upload', async (req, res) => {
      let receivedSize = 0;
      req.onData((chunk, isLast) => {
        receivedSize += chunk.length;
        if (isLast) {
          res.json({ size: receivedSize });
        }
      });
    });

    await app.listen(3015);
  });

  afterAll(async () => {
    await app.close();
    if (fs.existsSync(largeFilePath)) fs.unlinkSync(largeFilePath);
    if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
  });

  it('should stream a large file using sendFile', async () => {
    const res = await fetch('http://127.0.0.1:3015/download');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Length')).toBe(largeFileSize.toString());
    
    const blob = await res.blob();
    expect(blob.size).toBe(largeFileSize);
  });

  it('should receive a large stream using onData', async () => {
    const dummyData = Buffer.alloc(1024 * 512, 'u'); // 512KB
    const res = await fetch('http://127.0.0.1:3015/upload', {
      method: 'POST',
      body: dummyData
    });
    
    const json = await res.json();
    expect(json.size).toBe(dummyData.length);
  });
});
