import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { CategoriesModule } from '../categories/categories.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { SizeChartsModule } from '../size-charts/size-charts.module';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [ProductsModule, CategoriesModule, VouchersModule, SizeChartsModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
