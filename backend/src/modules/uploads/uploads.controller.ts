import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { upload } from './upload-interceptor';
import { UploadsService } from './uploads.service';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('post-media')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(upload(15))
  uploadPostMedia(@UploadedFile() file: Express.Multer.File) {
    return this.uploadsService.uploadPostMedia(file);
  }

  // Only accounts with a verified email can sell, so only they can upload
  // listing photos.
  @Post('listing-image')
  @UseGuards(VerifiedEmailGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(upload(8))
  uploadListingImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadsService.uploadListingImage(file);
  }
}
