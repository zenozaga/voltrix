import type { IRequest } from '../types/http.js';

const RE_BOUNDARY = /boundary=(?:"([^"]+)"|([^;]+))/;
const RE_NAME = /name="([^"]+)"/;
const RE_FILENAME = /filename="([^"]+)"/;
const CRLF_CRLF = Buffer.from('\r\n\r\n');

export interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  headers: Record<string, string>;
  // For streaming, we'll expose a way to get data chunks
  onData?: (chunk: Uint8Array, isLast: boolean) => void;
  // For compatibility with simple handlers
  data?: Uint8Array; 
}

export type PartHandler = (part: MultipartPart) => void | Promise<void>;

export class MultipartParser {
  private boundary: Buffer;
  private state: 'BOUNDARY' | 'HEADER' | 'BODY' | 'END' = 'BOUNDARY';
  private buffer: Buffer = Buffer.alloc(0);

  private onPart: PartHandler;
  private activePart?: MultipartPart;
  private partDataBuffer: Uint8Array[] = []; // Used if onData is NOT provided

  constructor(boundary: string, onPart: PartHandler) {
    this.boundary = Buffer.from('--' + boundary);
    this.onPart = onPart;
  }

  push(chunk: Uint8Array): void {
    // We MUST copy the chunk because the uWS ArrayBuffer view is transient
    const copy = Buffer.from(chunk);

    this.buffer = this.buffer.length === 0
      ? copy
      : Buffer.concat([this.buffer, copy]);

    this.parse();
  }

  private parse(): void {
    let offset = 0;

    while (offset < this.buffer.length) {
      if (this.state === 'BOUNDARY') {
        const index = this.indexOf(this.buffer, this.boundary, offset);
        if (index === -1) break;

        // Check for end boundary
        if (index + this.boundary.length + 1 < this.buffer.length &&
            this.buffer[index + this.boundary.length] === 45 && 
            this.buffer[index + this.boundary.length + 1] === 45) {
            
            if (this.activePart && this.activePart.onData) {
                this.activePart.onData(new Uint8Array(0), true);
            }
            
            this.state = 'END';
            this.buffer = Buffer.alloc(0);
            return;
        }

        offset = index + this.boundary.length + 2; // Skip \r\n
        this.state = 'HEADER';
      } 
      else if (this.state === 'HEADER') {
        const index = this.buffer.indexOf(CRLF_CRLF, offset);
        if (index === -1) break;

        const headerSection = this.buffer.toString('utf8', offset, index);
        const headers = this.parseHeaders(headerSection);

        const cd = headers['content-disposition'] || '';
        const nameMatch = RE_NAME.exec(cd);
        const filenameMatch = RE_FILENAME.exec(cd);

        this.activePart = {
          name: nameMatch ? nameMatch[1] : '',
          filename: filenameMatch ? filenameMatch[1] : undefined,
          contentType: headers['content-type'],
          headers
        };

        // Notify consumer of new part
        this.onPart(this.activePart);

        offset = index + 4;
        this.state = 'BODY';
      } 
      else if (this.state === 'BODY') {
        const index = this.indexOf(this.buffer, this.boundary, offset);
        
        if (index === -1) {
            // No boundary found. We can yield data up to (buffer.length - boundary.length - safety)
            // The safety of 4 bytes is for the CRLF preceding the boundary and the --
            const safety = this.boundary.length + 4;
            const yieldEnd = this.buffer.length - safety;
            
            if (yieldEnd > offset) {
                const chunk = this.buffer.subarray(offset, yieldEnd);
                this.emitPartData(chunk, false);
                offset = yieldEnd;
            }
            break;
        }

        // Boundary found!
        const bodyChunk = this.buffer.subarray(offset, index - 2); // -2 for \r\n
        this.emitPartData(bodyChunk, true);

        offset = index;
        this.state = 'BOUNDARY';
        this.activePart = undefined;
      }
    }

    if (offset > 0) {
      this.buffer = this.buffer.subarray(offset);
    }
  }

  private emitPartData(chunk: Uint8Array, isLast: boolean): void {
    if (!this.activePart) return;
    
    if (this.activePart.onData) {
        this.activePart.onData(chunk, isLast);
    } else {
        // Fallback: Buffer it (but encouraged is onData)
        this.partDataBuffer.push(new Uint8Array(chunk));
        if (isLast) {
            const totalLength = this.partDataBuffer.reduce((acc, b) => acc + b.length, 0);
            const fullBody = new Uint8Array(totalLength);
            let pos = 0;
            for (const b of this.partDataBuffer) {
                fullBody.set(b, pos);
                pos += b.length;
            }
            this.activePart.data = fullBody;
            this.partDataBuffer = [];
        }
    }
  }

  private indexOf(haystack: Buffer, needle: Buffer, offset: number): number {
    return haystack.indexOf(needle, offset);
  }

  private parseHeaders(raw: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = raw.split('\r\n');
    for (const line of lines) {
        const idx = line.indexOf(':');
        if (idx > 0) {
            const name = line.substring(0, idx).trim().toLowerCase();
            const value = line.substring(idx + 1).trim();
            headers[name] = value;
        }
    }
    return headers;
  }
}

export async function parseMultipart(req: IRequest, onPart: PartHandler): Promise<void> {
  const contentType = req.header('content-type');
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new Error('Not a multipart request');
  }

  const boundaryMatch = RE_BOUNDARY.exec(contentType);
  if (!boundaryMatch) {
    throw new Error('Multipart boundary not found');
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const parser = new MultipartParser(boundary, onPart);

  return new Promise((resolve, reject) => {
    req.onData((chunk: Uint8Array, isLast: boolean) => {
      try {
        parser.push(chunk);
        if (isLast) resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}
