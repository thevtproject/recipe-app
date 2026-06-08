import sharp from 'sharp';

// Recipe photos: full-quality archival-friendly, max 1920px wide, aspect preserved.
const RECIPE_MAX_WIDTH = 1920;
const RECIPE_WEBP_QUALITY = 85;

// Avatars: square 512x512 cover crop, higher quality since small + identity-bearing.
const AVATAR_SIZE = 512;
const AVATAR_WEBP_QUALITY = 90;

/**
 * Process a recipe photo upload.
 * - Resize so the longest side is at most 1920px (aspect preserved).
 * - Convert to WebP at quality 85.
 * Returns a buffer ready to be written to disk as `.webp`.
 */
export async function processRecipeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // honor EXIF orientation
    .resize({
      width: RECIPE_MAX_WIDTH,
      withoutEnlargement: true,
    })
    .webp({ quality: RECIPE_WEBP_QUALITY })
    .toBuffer();
}

/**
 * Process an avatar upload.
 * - Center-cover-crop to 512x512.
 * - Convert to WebP at quality 90.
 * Returns a buffer ready to be written to disk as `.webp`.
 */
export async function processAvatarImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // honor EXIF orientation
    .resize({
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: AVATAR_WEBP_QUALITY })
    .toBuffer();
}

/** The file extension we always save processed images as. */
export const PROCESSED_IMAGE_EXT = 'webp';
