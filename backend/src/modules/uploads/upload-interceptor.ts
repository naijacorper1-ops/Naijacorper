import { FileInterceptor } from '@nestjs/platform-express';

// Reads one file from the "file" field. multer stops reading the request as
// soon as the file passes the size limit, so a huge upload can no longer fill
// the server's memory first (a too-big file gets a 413 response).
export const upload = (maxMb: number) =>
  FileInterceptor('file', { limits: { fileSize: maxMb * 1024 * 1024, files: 1 } });
