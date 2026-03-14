import { describe, it, expect } from 'vitest';
import { voltrix } from '../src/index.js';

describe('Multipart Upload', () => {
    it('should parse multipart fields and files', async () => {
        const app = voltrix();
        
        const receivedParts: any[] = [];
        
        app.post('/upload', async (req, res) => {
            await req.parseMultipart((part) => {
                let chunks: Uint8Array[] = [];
                part.onData = (chunk: Uint8Array, isLast: boolean) => {
                    if (chunk.length > 0) chunks.push(chunk);
                    if (isLast) {
                        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
                        const fullData = new Uint8Array(totalLength);
                        let pos = 0;
                        for (const c of chunks) {
                            fullData.set(c, pos);
                            pos += c.length;
                        }
                        receivedParts.push({
                            name: part.name,
                            filename: part.filename,
                            contentType: part.contentType,
                            dataLength: fullData.length,
                            data: Buffer.from(fullData).toString()
                        });
                    }
                };
            });
            res.json({ success: true, count: receivedParts.length });
        });

        await app.listen(3016);

        try {
            const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
            const body = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="field1"',
                '',
                'value1',
                `--${boundary}`,
                'Content-Disposition: form-data; name="file1"; filename="test.txt"',
                'Content-Type: text/plain',
                '',
                'hello world',
                `--${boundary}--`,
                ''
            ].join('\r\n');

            const res = await fetch('http://127.0.0.1:3016/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body
            });

            const json = await res.json();
            expect(json.success).toBe(true);
            expect(json.count).toBe(2);

            expect(receivedParts[0].name).toBe('field1');
            expect(receivedParts[0].data).toBe('value1');

            expect(receivedParts[1].name).toBe('file1');
            expect(receivedParts[1].filename).toBe('test.txt');
            expect(receivedParts[1].data).toBe('hello world');

        } finally {
            await app.close();
        }
    });
});
