import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SizeChart, SizeChartSchema } from './schemas/size-chart.schema';
import { SizeChartsController } from './size-charts.controller';
import { SizeChartsService } from './size-charts.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SizeChart.name, schema: SizeChartSchema }]),
  ],
  controllers: [SizeChartsController],
  providers: [SizeChartsService],
  exports: [SizeChartsService],
})
export class SizeChartsModule {}
