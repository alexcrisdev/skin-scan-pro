// 3 MiB becomes 4 MiB of Base64, leaving room for JSON and the signed URL
// under Vercel's 4.5 MB request limit. Keep browser and API limits aligned.
export const MAX_ANALYSIS_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_ANALYSIS_BASE64_LENGTH = 4 * Math.ceil(MAX_ANALYSIS_IMAGE_BYTES / 3);
