import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { processRecipeImage, PROCESSED_IMAGE_EXT } from '@/lib/images';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Check magic bytes (first 12 bytes)
function detectMime(buf: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
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

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ data: null, error: 'File exceeds 5MB limit' }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  // Validate by magic bytes — do NOT trust Content-Type header
  const detectedMime = detectMime(buf);
  if (!detectedMime || !ALLOWED_MIME[detectedMime]) {
    return NextResponse.json({ data: null, error: 'Only JPEG, PNG, WebP allowed' }, { status: 415 });
  }

  const ext = PROCESSED_IMAGE_EXT;
  const filename = `${crypto.randomUUID()}.${ext}`;

  // Re-encode via sharp: strips EXIF, enforces 1920px max, converts to WebP
  let processed: Buffer;
  try {
    processed = await processRecipeImage(buf);
  } catch (err) {
    console.error('[upload] sharp processing failed', err);
    return NextResponse.json({ data: null, error: 'Failed to process image' }, { status: 422 });
  }

  const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), processed);

  return NextResponse.json({ data: { url: `/uploads/${filename}` }, error: null }, { status: 201 });
}
