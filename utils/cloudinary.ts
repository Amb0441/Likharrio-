import Constants from "expo-constants";

// ─────────────────────────────────────────────────────────────
// Cloudinary Image Upload Utility
// ─────────────────────────────────────────────────────────────

const embedded = (Constants.expoConfig?.extra?.cloudinary ?? {}) as {
  cloudName?: string;
  uploadPreset?: string;
};

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || embedded.cloudName || 'iujkeldd';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || embedded.uploadPreset || 'Likharrio';

export type UploadFolder = 'profiles' | 'verifications' | 'listings' | 'portfolios';

// ─── Per-folder transform settings ───────────────────────────
// quality: 'auto:good' = Cloudinary picks best quality/size balance
// fetch_format: 'auto' = serves WebP on supported devices, JPEG elsewhere
// width: max display width in pixels (Cloudinary resizes server-side)
const TRANSFORMS: Record<UploadFolder, { width: number; quality: string }> = {
  profiles:      { width: 400,  quality: 'auto:good' },  // avatar — small
  verifications: { width: 1200, quality: 'auto:good' },  // ID docs — keep detail
  listings:      { width: 1000, quality: 'auto:good' },  // product photos
  portfolios:    { width: 1200, quality: 'auto:best' },  // artwork — highest quality
};

/**
 * Builds an optimized Cloudinary URL from a raw secure_url.
 * Injects width + quality + format transformations into the URL path.
 *
 * Example:
 *   raw:  https://res.cloudinary.com/iujkeldd/image/upload/v123/likharrio/listings/abc.jpg
 *   opt:  https://res.cloudinary.com/iujkeldd/image/upload/w_1000,q_auto:good,f_auto/v123/likharrio/listings/abc.jpg
 */
export function getOptimizedUrl(rawUrl: string, folder: UploadFolder): string {
  if (!rawUrl) return rawUrl;
  const { width, quality } = TRANSFORMS[folder];
  // Insert transformation string after "/upload/"
  return rawUrl.replace(
    '/upload/',
    `/upload/w_${width},q_${quality},f_auto/`
  );
}

/**
 * Uploads a single image to Cloudinary and returns an optimized URL.
 * The optimized URL applies server-side compression + format conversion.
 */
export async function uploadImageToCloudinary(
  uri: string,
  folder: UploadFolder = 'listings'
): Promise<string> {
  const formData = new FormData();

  if (uri.startsWith('data:')) {
    formData.append('file', uri);
  } else {
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: `upload_${Date.now()}.jpg`,
    } as any);
  }

  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `likharrio/${folder}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || 'Cloudinary upload failed');
  }

  const data = await response.json();

  // Return optimized URL instead of raw URL
  return getOptimizedUrl(data.secure_url as string, folder);
}

/**
 * Uploads multiple images in sequence using the same folder/preset.
 * Returns an array of optimized URLs in the same order.
 */
export async function uploadMultipleImages(
  uris: string[],
  folder: UploadFolder = 'portfolios'
): Promise<string[]> {
  const urls: string[] = [];
  for (const uri of uris) {
    const url = await uploadImageToCloudinary(uri, folder);
    urls.push(url);
  }
  return urls;
}