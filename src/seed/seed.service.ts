import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from '../products/products.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_VOUCHERS } from './seed-data';

@Injectable()
export class SeedService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
    private readonly vouchersService: VouchersService
  ) {}

  async run(force = false) {
    const count = await this.productsService.count();
    if (count > 0 && !force) {
      return { skipped: true, message: 'Database already seeded', productCount: count };
    }

    const [categories, products, vouchers] = await Promise.all([
      this.categoriesService.upsertMany(SEED_CATEGORIES),
      this.productsService.upsertMany(SEED_PRODUCTS),
      this.vouchersService.upsertMany(SEED_VOUCHERS),
    ]);

    return {
      skipped: false,
      categories,
      products,
      vouchers,
      productCount: await this.productsService.count(),
    };
  }
}
