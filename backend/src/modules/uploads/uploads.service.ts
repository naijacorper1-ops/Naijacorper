import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import {
  DOCUMENT_KINDS,
  FileKind,
  IMAGE_KINDS,
  STATIC_IMAGE_KINDS,
  VIDEO_KINDS,
  detectFileKind,
} from '../../common/utils/file-sniff';
import { isOurCloudinaryUrl } from '../../common/validators/cloudinary-url.validator';

export type PublicFolder = 'posts' | 'listings' | 'avatars' | 'groups';

export interface StoredDocument {
  publicId: string;
  resourceType: string;
  format: string | null;
}

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.configService.get<string>('cloudinary.cloudName'),
      api_key: this.configService.get<string>('cloudinary.apiKey'),
      api_secret: this.configService.get<string>('cloudinary.apiSecret'),
    });
  }

  // Photos and short videos for posts.
  async uploadPostMedia(file: Express.Multer.File | undefined) {
    return this.uploadPublic(file, 'posts', [...IMAGE_KINDS, ...VIDEO_KINDS]);
  }

  // Photos only. A listing is a product photo, not a video.
  async uploadListingImage(file: Express.Multer.File | undefined) {
    return this.uploadPublic(file, 'listings', IMAGE_KINDS);
  }

  // Cropped to a square around the face or main subject, so every avatar
  // has the same shape no matter what the user uploaded.
  async uploadAvatar(file: Express.Multer.File | undefined) {
    return this.uploadPublic(file, 'avatars', STATIC_IMAGE_KINDS, {
      transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto' }],
    });
  }

  async uploadGroupAvatar(file: Express.Multer.File | undefined) {
    return this.uploadPublic(file, 'groups', STATIC_IMAGE_KINDS, {
      transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto' }],
    });
  }

  // Verification documents are stored as "authenticated" files, which cannot
  // be opened without a signed link. We keep only the file's id. A fresh
  // short-lived link is made each time an admin opens it (see signedDocumentUrl),
  // because a link saved at upload time expires after minutes.
  async uploadVerificationDocument(file: Express.Multer.File | undefined): Promise<StoredDocument> {
    const buffer = this.requireKind(file, DOCUMENT_KINDS);

    const result = await this.streamUpload(buffer, {
      folder: 'naijacorper/verification',
      resource_type: 'auto',
      type: 'authenticated',
    });

    return {
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format ?? null,
    };
  }

  // A link that works for 10 minutes, made on demand for an admin.
  signedDocumentUrl(doc: { publicId: string; resourceType: string | null; format: string | null }) {
    return cloudinary.utils.private_download_url(doc.publicId, doc.format ?? '', {
      resource_type: doc.resourceType ?? 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 10 * 60,
    });
  }

  // Deletes a private verification file. Never throws: a failed cleanup must
  // not undo an admin's decision. The error is logged instead.
  async deleteDocument(doc: { publicId: string; resourceType: string | null }) {
    try {
      await cloudinary.uploader.destroy(doc.publicId, {
        resource_type: doc.resourceType ?? 'image',
        type: 'authenticated',
        invalidate: true,
      });
      return true;
    } catch (error) {
      this.logger.error(`Could not delete verification file ${doc.publicId}`, String(error));
      return false;
    }
  }

  // Deletes one of our own public images (for example the old avatar after a
  // new one is uploaded). Links that are not ours are ignored.
  async deleteByUrl(url: string | null | undefined) {
    if (!url) {
      return;
    }

    const match = url.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(naijacorper\/.+?)(?:\.[a-zA-Z0-9]+)?$/);

    if (!match || !isOurCloudinaryUrl(url, this.folderOf(match[2]))) {
      return;
    }

    try {
      await cloudinary.uploader.destroy(match[2], { resource_type: match[1], invalidate: true });
    } catch (error) {
      this.logger.warn(`Could not delete ${match[2]}: ${String(error)}`);
    }
  }

  private folderOf(publicId: string) {
    return publicId.split('/')[1] ?? '';
  }

  private async uploadPublic(
    file: Express.Multer.File | undefined,
    folder: PublicFolder,
    allowed: FileKind[],
    extra: Record<string, unknown> = {},
  ) {
    const buffer = this.requireKind(file, allowed);
    const kind = detectFileKind(buffer) as FileKind;

    const result = await this.streamUpload(buffer, {
      folder: `naijacorper/${folder}`,
      resource_type: VIDEO_KINDS.includes(kind) ? 'video' : 'image',
      ...extra,
    });

    return { url: result.secure_url };
  }

  // The type a browser reports is only what the uploader claims. The real
  // type is read from the first bytes of the file.
  private requireKind(file: Express.Multer.File | undefined, allowed: FileKind[]): Buffer {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('A file is required (send it in the "file" field)');
    }

    const kind = detectFileKind(file.buffer);

    if (!kind || !allowed.includes(kind)) {
      throw new BadRequestException(
        `This file type is not allowed here. Allowed: ${allowed.join(', ')}`,
      );
    }

    return file.buffer;
  }

  private streamUpload(buffer: Buffer, options: Record<string, unknown>): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) {
          this.logger.error('Cloudinary upload failed', String(error?.message ?? error));
          reject(new BadRequestException('The file could not be uploaded. Please try another file.'));
          return;
        }
        resolve(result);
      });

      Readable.from(buffer).pipe(uploadStream);
    });
  }
}
