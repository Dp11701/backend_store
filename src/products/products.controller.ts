import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { parseProductListQuery } from './product-list.query';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    return this.productsService.findAll(parseProductListQuery(query));
  }

  @Get('facets')
  facets(@Query('category') category?: string) {
    if (!category?.trim()) {
      return { category: '', total: 0, priceMin: 0, priceMax: 0, colors: [], sizes: [], saleCount: 0, newCount: 0, inStockCount: 0 };
    }
    return this.productsService.getFacets(category.trim());
  }

  /** Thời gian kết thúc flash sale gần nhất (cho countdown homepage) */
  @Get('flash-sale')
  flashSale() {
    return this.productsService.getFlashSaleMeta();
  }

  @Get('slug/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.productsService.findByProductId(id);
  }
}
