import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { CreateProductDto, UpdateProductDto } from '../products/dto/product.dto';

@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
