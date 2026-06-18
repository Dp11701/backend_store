import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module';
import { SizeChartsModule } from '../size-charts/size-charts.module';
import { UploadsModule } from '../uploads/uploads.module';
import { GeminiService } from './gemini.service';
import { StylistJob, StylistJobSchema } from './schemas/stylist-job.schema';
import { StylistController } from './stylist.controller';
import { StylistJobsService } from './stylist-jobs.service';
import { StylistService } from './stylist.service';

@Module({
  imports: [
    ProductsModule,
    SizeChartsModule,
    UploadsModule,
    MongooseModule.forFeature([{ name: StylistJob.name, schema: StylistJobSchema }]),
  ],
  controllers: [StylistController],
  providers: [StylistService, StylistJobsService, GeminiService],
  exports: [StylistService],
})
export class StylistModule {}
