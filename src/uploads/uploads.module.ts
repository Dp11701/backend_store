import { Module } from '@nestjs/common';
import { AdminUploadsController } from './admin-uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [AdminUploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
