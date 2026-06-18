import { Controller, Get, Param, Query } from '@nestjs/common';
import { SizeChartsService } from './size-charts.service';

@Controller('size-charts')
export class SizeChartsController {
  constructor(private readonly sizeChartsService: SizeChartsService) {}

  @Get()
  list() {
    return this.sizeChartsService.findAll();
  }

  @Get('default')
  defaultChart() {
    return this.sizeChartsService.findDefault();
  }

  /** ?productId=…&categorySlug=…&sizeChartId=… */
  @Get('resolve')
  resolve(
    @Query('sizeChartId') sizeChartId?: string,
    @Query('categorySlug') categorySlug?: string,
  ) {
    return this.sizeChartsService.resolveForProduct(sizeChartId, categorySlug);
  }

  @Get('slug/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.sizeChartsService.findBySlug(slug);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.sizeChartsService.findById(id);
  }
}
