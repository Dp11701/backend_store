import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from '../products/products.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { SizeChartsService } from '../size-charts/size-charts.service';
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_VOUCHERS } from './seed-data';
import { SEED_SIZE_CHARTS, sizeChartIdForCategory } from './size-chart-data';
import { randomProductStats } from './product-stats.util';

@Injectable()
export class SeedService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
    private readonly vouchersService: VouchersService,
    private readonly sizeChartsService: SizeChartsService,
  ) {}

  async run(force = false) {
    const count = await this.productsService.count();
    if (count > 0 && !force) {
      return { skipped: true, message: 'Database already seeded', productCount: count };
    }

    const saleEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const products = SEED_PRODUCTS.map((p) => {
      const stats = randomProductStats();
      const salePatch = p.isSale ? { saleStartsAt: new Date(), saleEndsAt } : {};
      const sizeChartId = sizeChartIdForCategory(p.categorySlug);
      return { ...p, ...stats, ...salePatch, sizeChartId };
    });

    const [categories, sizeCharts, productResult, vouchers] = await Promise.all([
      this.categoriesService.upsertMany(SEED_CATEGORIES),
      this.sizeChartsService.upsertMany(SEED_SIZE_CHARTS),
      this.productsService.upsertMany(products),
      this.vouchersService.upsertMany(SEED_VOUCHERS),
    ]);

    return {
      skipped: false,
      categories,
      sizeCharts,
      products: productResult,
      vouchers,
      productCount: await this.productsService.count(),
    };
  }

  async randomizeProductStats() {
    return this.productsService.randomizeProductStats();
  }

  async seedSizeCharts() {
    return this.sizeChartsService.upsertMany(SEED_SIZE_CHARTS);
  }
}
