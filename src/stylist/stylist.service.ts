import { BadRequestException, Injectable } from '@nestjs/common';
import { UploadsService } from '../uploads/uploads.service';
import { CreateStylistJobDto } from './dto/create-stylist-job.dto';
import { RecommendSizeDto } from './dto/recommend-size.dto';
import { GeminiService } from './gemini.service';
import { StylistJobsService } from './stylist-jobs.service';

@Injectable()
export class StylistService {
  constructor(
    private readonly jobs: StylistJobsService,
    private readonly gemini: GeminiService,
    private readonly uploads: UploadsService,
  ) {}

  getStatus() {
    return {
      phase: 2,
      aiEnabled: this.gemini.isEnabled(),
      features: {
        sizeRecommendation: true,
        geminiAdvice: this.gemini.isEnabled(),
        photoUpload: this.uploads.isConfigured(),
        asyncJobs: true,
        virtualTryOn: this.gemini.isEnabled(),
      },
    };
  }

  uploadPhoto(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Không có file');
    }
    return this.uploads.upload(file, 'stylist');
  }

  createJob(dto: CreateStylistJobDto) {
    return this.jobs.createJob(dto);
  }

  getJob(jobId: string) {
    return this.jobs.getJob(jobId);
  }

  async recommend(dto: RecommendSizeDto) {
    return this.jobs.buildRecommendation(dto);
  }
}
