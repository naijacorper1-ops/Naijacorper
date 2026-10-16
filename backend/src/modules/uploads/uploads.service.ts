import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class UploadsService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.configService.get<string>('cloudinary.cloudName'),
      api_key: this.configService.get<string>('cloudinary.apiKey'),
      api_secret: this.configService.get<string>('cloudinary.apiSecret'),
    });
  }

  async uploadPostMedia(file: Express.Multer.File) {
    const result = await this.streamUpload(file.buffer, {
      folder: 'naijacorper/posts',
      resource_type: 'auto',
    });

    return { url: result.secure_url };
  }

  // Verification documents go in as "authenticated" delivery, not public,
  // and come back as a short-lived signed URL instead of a permanent one.
  async uploadVerificationDocument(file: Express.Multer.File) {
    const result = await this.streamUpload(file.buffer, {
      folder: 'naijacorper/verification',
      resource_type: 'auto',
      type: 'authenticated',
    });

    const url = cloudinary.utils.private_download_url(result.public_id, result.format, {
      resource_type: result.resource_type,
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 60 * 15,
    });

    return { url };
  }

  private streamUpload(
    buffer: Buffer,
    options: Record<string, unknown>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) {
          reject(error);
          return;
        }
        resolve(result);
      });

      Readable.from(buffer).pipe(uploadStream);
    });
  }
}
