import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { processAvatarImage, PROCESSED_IMAGE_EXT } from '@/lib/images';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Only used to decide whether the upload is a supported image —
// we always re-encode to WebP after processing, so the on-disk
// extension is always `.webp` regardless of the source mime type.
const ALLOWED_MIME: Record<string, true> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
};

// Validate by file magic bytes — never trust the Content-Type header
function detectMime(buf: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // WebP: 52 49 46 46 .... 57 45 42 50
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';
  return null;
}

// POST /api/profile/avatar — upload an avatar image (multipart/form-data, field: `file`)
// Returns the public URL the client should PATCH into User.avatarUrl via /api/profile.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Invalid session' }, { status: 401 });
  }

  // Rate limit per IP — 30 uploads per hour. Avatars + recipe photos share
  // the same bucket to keep the attack surface tight.
  const rl = rateLimit('upload', getClientIp(req));
  if (!rl.ok) {
    return NextResponse.json(
      { data: null, error: `Too many uploads. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ data: null, error: 'No file provided' }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ data: null, error: 'File is empty' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ data: null, error: 'File exceeds 5MB limit' }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  const detectedMime = detectMime(buf);
  if (!detectedMime || !ALLOWED_MIME[detectedMime]) {
    return NextResponse.json(
      { data: null, error: 'Only JPEG, PNG, WebP allowed' },
      { status: 415 }
    );
  }

  // Re-encode through sharp (resize to 512x512 cover, convert to WebP).
  let processed: Buffer;
  try {
    processed = await processAvatarImage(buf);
  } catch (err) {
    console.error('[avatar] sharp processing failed', err);
    return NextResponse.json(
      { data: null, error: 'Failed to process image' },
      { status: 422 }
    );
  }

  const filename = `${crypto.randomUUID()}.${PROCESSED_IMAGE_EXT}`;

  const baseUploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'public', 'uploads');
  const avatarDir = join(baseUploadDir, 'avatars');
  await mkdir(avatarDir, { recursive: true });

  // Look up the previous avatar so we can remove the orphan file from disk.
  // We do this BEFORE writing the new file so a partial failure doesn't
  // leave the user with no avatar.
  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  await writeFile(join(avatarDir, filename), processed);

  const avatarUrl = `/uploads/avatars/${filename}`;

  // Best-effort cleanup of the previous avatar file. We don't await-fail:
  // orphaned files are cosmetic, the new URL is what gets returned.
  const prevUrl = previous?.avatarUrl;
  if (prevUrl && prevUrl !== avatarUrl && prevUrl.startsWith('/uploads/avatars/')) {
    const prevFilename = prevUrl.replace('/uploads/avatars/', '');
    // Defence-in-depth against path traversal: only allow the basename
    // (no slashes, no '..').
    if (/^[a-zA-Z0-9._-]+$/.test(prevFilename)) {
      const prevPath = join(avatarDir, prevFilename);
      unlink(prevPath).catch((err) => {
        console.warn('[avatar] failed to delete old avatar', prevPath, err);
      });
    }
  }

  return NextResponse.json({ data: { avatarUrl }, error: null }, { status: 201 });
}
