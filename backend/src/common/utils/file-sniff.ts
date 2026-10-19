export type FileKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'pdf' | 'mp4' | 'mov';

// Works out what a file really is from its first bytes. The type a browser
// reports (the mimetype) is just what the uploader claims, so a script
// renamed to photo.jpg would otherwise get through.
export function detectFileKind(buffer: Buffer): FileKind | null {
  if (buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }

  const head6 = buffer.subarray(0, 6).toString('ascii');

  if (head6 === 'GIF87a' || head6 === 'GIF89a') {
    return 'gif';
  }

  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }

  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'pdf';
  }

  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    // "qt  " is the QuickTime brand (iPhone .mov files). Everything else is MP4.
    return buffer.subarray(8, 12).toString('ascii') === 'qt  ' ? 'mov' : 'mp4';
  }

  return null;
}

export const IMAGE_KINDS: FileKind[] = ['jpeg', 'png', 'gif', 'webp'];
export const STATIC_IMAGE_KINDS: FileKind[] = ['jpeg', 'png', 'webp'];
export const VIDEO_KINDS: FileKind[] = ['mp4', 'mov'];
export const DOCUMENT_KINDS: FileKind[] = ['jpeg', 'png', 'webp', 'pdf'];
