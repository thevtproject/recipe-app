// Simple in-memory rate limiter
// Family app with <100 expected users — overkill solutions (Redis, etc.)
// are not justified. Sliding window keyed on (route, key).
//
// NOTE: in-memory means each Node process has its own counter. With a single
// app container (our deploy topology) this is fine. If we ever scale to >1
// replica, swap for Redis. The interface is deliberately Redis-friendly.

type Entry = { count: number; resetAt: number };

class Bucket {
  private map = new Map<string, Entry>();
  // sweep stale entries every 5 minutes to avoid memory growth
  private lastSweep = Date.now();
  private readonly sweepIntervalMs = 5 * 60_000;

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  hit(key: string): { ok: boolean; retryAfterSec: number } {
    const now = Date.now();
    if (now - this.lastSweep > this.sweepIntervalMs) {
      this.sweep();
      this.lastSweep = now;
    }
    const entry = this.map.get(key);
    if (!entry || entry.resetAt <= now) {
      this.map.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true, retryAfterSec: 0 };
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { ok: true, retryAfterSec: 0 };
  }

  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.map.entries()) {
      if (v.resetAt <= now) this.map.delete(k);
    }
  }
}

const buckets = {
  // Per-IP: 5 attempts per 15 minutes. Bursts for typos, but blocks
  // scripted account spam and credential stuffing.
  authRegister: new Bucket(5, 15 * 60_000),
  // Per-IP: 5 password reset requests per 15 minutes.
  forgotPassword: new Bucket(5, 15 * 60_000),
  // Per-IP: 10 attempts per 5 minutes. Generous to handle UI flakiness.
  authLogin: new Bucket(10, 5 * 60_000),
  // Per-IP: 30 file uploads per hour. Photos only — uploads are expensive.
  upload: new Bucket(30, 60 * 60_000),
  // Per-user: 20 password-change attempts per hour.
  passwordChange: new Bucket(20, 60 * 60_000),
  // Per-user: 5 share-link creations per hour. Avoids link-spam if compromised.
  shareCreate: new Bucket(5, 60 * 60_000),
  // Per-IP: 10 invite-code attempts per 15 minutes. Prevents brute-force
  // enumeration of household invite codes.
  householdJoin: new Bucket(10, 15 * 60_000),
};

export type BucketName = keyof typeof buckets;

/** Get the client IP from standard proxy / Cloudflare / direct hops.
 *
 * Priority:
 *   1. CF-Connecting-IP  — set by Cloudflare before tunnelling to origin
 *   2. X-Real-IP         — set by nginx after applying real_ip_header
 *   3. X-Forwarded-For   — leftmost untrusted hop (last resort only)
 *
 * We trust the first two because only an authorised gateway can set them.
 * Taking the leftmost XFF directly is avoided: if the attacker bypasses
 * Cloudflare and sends a forged XFF, leftmost would be attacker-controlled.
 */
export function getClientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return 'unknown';
}

export function rateLimit(name: BucketName, key: string) {
  return buckets[name].hit(key);
}
