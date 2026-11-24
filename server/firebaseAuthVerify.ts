import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const ADMIN_AUTH_EMAIL = 'admin@amromansour-law.eg';
const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache | null = null;

function readProvisionedProjectId(): string {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed.projectId && typeof parsed.projectId === 'string') {
      return parsed.projectId.trim();
    }
  } catch {
    // Fallback below if config file is absent
  }
  return process.env.FIREBASE_PROJECT_ID?.trim() || 'misr-suuq';
}

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  return Buffer.from(padded, 'base64');
}

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) {
    return certCache.certs;
  }

  const response = await fetch(FIREBASE_CERTS_URL, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Failed to load Firebase public certificates (${response.status})`);
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeSec = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) : 3600;
  const certs = (await response.json()) as Record<string, string>;

  certCache = {
    certs,
    expiresAt: now + maxAgeSec * 1000,
  };
  return certs;
}

export interface VerifiedAdminClaims {
  uid: string;
  email: string;
}

export async function verifyFirebaseAdminToken(
  token: string
): Promise<VerifiedAdminClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(decodeBase64Url(headerB64).toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    firebase?: { sign_in_provider?: string };
  };

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported token header');
  }

  const certs = await getFirebasePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    // Force refresh once in case Firebase rotated keys
    certCache = null;
    const refreshedCerts = await getFirebasePublicCerts();
    if (!refreshedCerts[header.kid]) {
      throw new Error('Unknown key ID');
    }
  }

  const activePem = (await getFirebasePublicCerts())[header.kid];
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signature = decodeBase64Url(signatureB64);
  if (!verifier.verify(activePem, signature)) {
    throw new Error('Invalid token signature');
  }

  const projectId = readProvisionedProjectId();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const nowSec = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new Error('Invalid token audience');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Invalid token issuer');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Missing subject');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec - 30) {
    throw new Error('Token expired');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Invalid issued-at timestamp');
  }

  const email = (payload.email || '').toLowerCase();
  const provider = payload.firebase?.sign_in_provider;
  if (email !== ADMIN_AUTH_EMAIL || provider !== 'password') {
    const err = new Error('FORBIDDEN_ACCOUNT');
    throw err;
  }

  return {
    uid: payload.sub,
    email,
  };
}

export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match || !match[1]) {
    res.status(401).json({
      error: 'يرجى تسجيل الدخول بحساب الإدارة للوصول إلى الأخبار المباشرة.',
    });
    return;
  }

  try {
    const claims = await verifyFirebaseAdminToken(match[1].trim());
    (req as Request & { adminClaims?: VerifiedAdminClaims }).adminClaims = claims;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'FORBIDDEN_ACCOUNT') {
      res.status(403).json({
        error: 'الوصول مقتصر على حساب الإدارة المصرح له فقط.',
      });
      return;
    }
    res.status(401).json({
      error: 'انتهت صلاحية جلسة الدخول أو الرمز غير صالح. يرجى تحديث الصفحة أو إعادة تسجيل الدخول.',
    });
  }
}
