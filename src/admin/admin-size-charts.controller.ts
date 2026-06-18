import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { SizeChartsService } from '../size-charts/size-charts.service';
import { CreateSizeChartDto, UpdateSizeChartDto } from '../size-charts/dto/size-chart.dto';

@Controller('admin/size-charts')
export class AdminSizeChartsController {
  constructor(private readonly sizeChartsService: SizeChartsService) {}

  @Post()
  create(@Body() dto: CreateSizeChartDto) {
    return this.sizeChartsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSizeChartDto) {
    return this.sizeChartsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sizeChartsService.remove(id);
  }
}
