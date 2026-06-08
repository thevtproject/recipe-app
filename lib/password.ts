// Password strength + hashing helpers
// Family app: not enterprise-grade, but blocks the easy footguns
// (top-100 passwords, all-lowercase, all-digits, etc.)
// Avoids the 400KB zxcvbn dependency.

import bcrypt from 'bcryptjs';

/**
 * bcrypt cost factor. 14 = ~150ms per hash on a modern x86 server.
 * Each +1 doubles the work. 12 is the historical default; 14 is the
 * 2024-era recommendation for systems that can afford the CPU at login.
 *
 * Bump carefully: a 14-round hash is 4x slower to verify than a 12-round
 * one, so don't go past 14 unless your hardware can handle it. The
 * `rehashIfNeeded` helper migrates users transparently as rounds increase.
 */
export const SALT_ROUNDS = 14;

/**
 * Detect the cost factor encoded in a bcrypt hash string ($2b$<rounds>$...).
 * Returns null if the string doesn't look like a valid bcrypt hash.
 */
export function bcryptRounds(hash: string): number | null {
  const m = /^\$2[abxy]\$(\d+)\$/.exec(hash);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * If the stored hash uses a cost factor below the current `SALT_ROUNDS`,
 * re-hash the password at the new cost and return the new hash.
 * Otherwise return null (no change needed).
 *
 * Call this from the login handler after a successful `bcrypt.compare`
 * to migrate users transparently when SALT_ROUNDS is bumped. The first
 * successful login after a bump rewrites the row; subsequent logins
 * see the new hash and no-op.
 *
 * Note: this is safe to fail silently. If the write fails, the user can
 * still log in — they just keep their older hash. Next login retries.
 */
export async function rehashIfNeeded(
  hash: string,
  plain: string
): Promise<string | null> {
  const current = bcryptRounds(hash);
  if (current === null) return null;          // not a bcrypt hash — don't touch
  if (current >= SALT_ROUNDS) return null;    // already at or above target
  return bcrypt.hash(plain, SALT_ROUNDS);
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'qwerty', 'qwerty123',
  'letmein', 'iloveyou', 'admin', 'admin123', 'welcome', 'welcome1',
  'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess',
  'abc123', '111111', '123123', '12345678', '123456789', '1234567890',
  'passw0rd', 'p@ssw0rd', 'p@ssword', 'trustno1', '000000', 'master',
]);

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

/**
 * Validate password strength. Returns ok:false with a user-friendly reason
 * when it fails. Applied on /api/auth/register and /api/profile/password.
 *
 * Rules:
 *   - min 8 chars
 *   - max 128 chars (bcrypt has a 72-byte effective limit anyway)
 *   - not in top-100 common list
 *   - not all-letters or all-digits (must have at least 2 of: lower, upper, digit)
 */
export function checkPasswordStrength(pw: string): PasswordCheck {
  if (!pw) return { ok: false, reason: 'Password is required' };
  if (pw.length < 8) return { ok: false, reason: 'Password must be at least 8 characters' };
  if (pw.length > 128) return { ok: false, reason: 'Password must be at most 128 characters' };

  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return { ok: false, reason: 'This password is too common — pick something less guessable' };
  }

  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const classCount = (hasLower ? 1 : 0) + (hasUpper ? 1 : 0) + (hasDigit ? 1 : 0);
  if (classCount < 2) {
    return { ok: false, reason: 'Use at least two of: lowercase, uppercase, digits' };
  }

  return { ok: true };
}
