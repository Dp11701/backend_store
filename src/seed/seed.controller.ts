import { Controller, Post, Query } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  run(@Query('force') force?: string) {
    return this.seedService.run(force === 'true');
  }

  @Post('stats')
  randomizeStats() {
    return this.seedService.randomizeProductStats();
  }

  @Post('size-charts')
  seedSizeCharts() {
    return this.seedService.seedSizeCharts();
  }
}
