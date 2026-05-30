import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { SessionOptions } from '../types/index.js';
import type { IRequest, IResponse, Middleware } from '@voltrix/core';
import { parseCookies, serializeCookie } from './csrf.js';

/**
 * Derives a robust 32-byte cryptographic key from any string using SHA-256.
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/**
 * AES-256-GCM Authenticated Encryption helper.
 */
export function encrypt(plainText: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * AES-256-GCM Authenticated Decryption helper.
 * Strictly checks integrity tags to prevent tamper/oracle attacks.
 */
export function decrypt(cipherText: string, key: Buffer): string | null {
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const tag = Buffer.from(parts[2], 'hex');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    // Return null on decryption/integrity failures
    return null;
  }
}

/**
 * High-performance Secure Session Middleware.
 * Supports stateless encrypted cookies (AES-256-GCM) and stateful shared session stores.
 */
export function session(options: SessionOptions): Middleware {
  if (!options || !options.secret) {
    throw new Error('[@voltrix/security] Session secret is required');
  }

  const key = deriveKey(options.secret);
  const cookieName = options.cookieName ?? 'voltrix_session';
  const ttlMs = options.ttlMs ?? 86400000; // 24h
  const store = options.store;
  const cookieOpts = options.cookieOptions ?? {
    path: '/',
    secure: false, // Default false, developers toggle true in production
    httpOnly: true, // Prevents XSS script execution reads
    sameSite: 'Lax'
  };

  return async (req, res, next) => {
    const cookies = parseCookies(req.header('cookie'));
    const sessionCookie = cookies[cookieName];
    
    let sessionData: Record<string, any> = {};
    let sessionId: string | null = null;
    let originalSessionJson = '{}';

    try {
      if (sessionCookie) {
        if (store) {
          // Stateful Store Mode: sessionCookie holds the encrypted sessionId
          const decryptedId = decrypt(sessionCookie, key);
          if (decryptedId) {
            sessionId = decryptedId;
            const dataStr = await store.get(`voltrix:security:session:${sessionId}`);
            if (dataStr) {
              sessionData = JSON.parse(dataStr);
              originalSessionJson = dataStr;
            }
          }
        } else {
          // Stateless Cookie Mode: sessionCookie holds the encrypted session payload
          const decryptedData = decrypt(sessionCookie, key);
          if (decryptedData) {
            sessionData = JSON.parse(decryptedData);
            originalSessionJson = decryptedData;
          }
        }
      }
    } catch {
      sessionData = {};
    }

    // Initialize session ID if not set (for store mode)
    if (store && !sessionId) {
      sessionId = randomBytes(24).toString('base64url');
    }

    // Attach session container to the request context
    if (!req.context) req.context = {};
    req.context.session = sessionData;

    // Hijack response flushing methods to automatically serialize and save the session if it changed
    let isSaved = false;
    const saveSessionSync = () => {
      if (isSaved) return;
      isSaved = true;
      try {
        const currentSessionJson = JSON.stringify(req.context.session ?? {});
        
        // Save only if session data was modified to eliminate redundant writes
        if (currentSessionJson !== originalSessionJson) {
          if (store && sessionId) {
            // Stateful Save (Fire-and-forget in the background to ensure zero latency on network flushes)
            store.set(`voltrix:security:session:${sessionId}`, currentSessionJson, ttlMs).catch(() => {});
            
            const encryptedCookie = encrypt(sessionId, key);
            res.setHeader('Set-Cookie', serializeCookie(cookieName, encryptedCookie, {
              ...cookieOpts,
              maxAge: Math.floor(ttlMs / 1000)
            }));
          } else {
            // Stateless Save (purely synchronous GCM encryption)
            const encryptedCookie = encrypt(currentSessionJson, key);
            res.setHeader('Set-Cookie', serializeCookie(cookieName, encryptedCookie, {
              ...cookieOpts,
              maxAge: Math.floor(ttlMs / 1000)
            }));
          }
        }
      } catch (err) {
        // Suppress session saving crashes
      }
    };

    const originalEnd = res.end;
    res.end = function (this: any, chunk?: any) {
      saveSessionSync();
      originalEnd.call(this, chunk);
    };

    if (res.json) {
      const originalJson = res.json;
      res.json = function (this: any, data: any, ...args: any[]) {
        saveSessionSync();
        (originalJson as any).apply(this, [data, ...args]);
      };
    }

    if (res.send) {
      const originalSend = res.send;
      res.send = function (this: any, body: any, ...args: any[]) {
        saveSessionSync();
        (originalSend as any).apply(this, [body, ...args]);
      };
    }

    next();
  };
}
