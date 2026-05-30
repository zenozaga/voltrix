/**
 * 📨 Normalization interface for WebSocket packets
 */
export interface WsPacket {
  readonly event: string;
  readonly data: any;
}

/**
 * ⚙️ High-performance packet parser/serializer.
 */
export class WsPacketParser {
  /**
   * Parses a raw string or ArrayBuffer payload into a normalized WsPacket.
   * Returns null if the payload does not conform to the expected format.
   */
  static parse(payload: string | ArrayBuffer | Buffer): WsPacket | null {
    let rawStr: string;

    if (payload instanceof ArrayBuffer) {
      rawStr = Buffer.from(payload).toString('utf8');
    } else if (Buffer.isBuffer(payload)) {
      rawStr = payload.toString('utf8');
    } else {
      rawStr = payload;
    }

    const trimmed = rawStr.trim();
    
    // Quick early boundary validation: Must look like a JSON object
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && typeof parsed.event === 'string') {
        return {
          event: parsed.event,
          data: parsed.data !== undefined ? parsed.data : null
        };
      }
    } catch {
      // Fail gracefully on invalid JSON structure
    }

    return null;
  }

  /**
   * Serializes an event and data object into a JSON string payload.
   */
  static serialize(event: string, data: any): string {
    return JSON.stringify({ event, data });
  }
}
