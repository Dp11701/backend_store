import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadFolder, UploadsService } from './uploads.service';

@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Get('status')
  status() {
    return this.uploads.getStatus();
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string
  ) {
    const resolved = (folder ?? 'products') as UploadFolder;
    if (!file) {
      throw new BadRequestException('Thiếu field file');
    }
    return this.uploads.upload(file, resolved);
  }
}
