import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreateStylistJobDto } from './dto/create-stylist-job.dto';
import { RecommendSizeDto } from './dto/recommend-size.dto';
import { StylistService } from './stylist.service';

const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

@Controller('stylist')
export class StylistController {
  constructor(private readonly stylistService: StylistService) {}

  @Get('status')
  status() {
    return this.stylistService.getStatus();
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: PHOTO_MAX_BYTES },
    }),
  )
  uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Thiếu field file');
    }
    return this.stylistService.uploadPhoto(file);
  }

  @Post('jobs')
  createJob(@Body() dto: CreateStylistJobDto) {
    return this.stylistService.createJob(dto);
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string) {
    return this.stylistService.getJob(jobId);
  }

  @Post('recommend')
  recommend(@Body() dto: RecommendSizeDto) {
    return this.stylistService.recommend(dto);
  }
}
