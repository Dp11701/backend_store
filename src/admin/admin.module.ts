import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { CategoriesModule } from '../categories/categories.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { UploadsModule } from '../uploads/uploads.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminProductsController } from './admin-products.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminVouchersController } from './admin-vouchers.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { SizeChartsModule } from '../size-charts/size-charts.module';
import { AdminSizeChartsController } from './admin-size-charts.controller';

@Module({
  imports: [ProductsModule, CategoriesModule, VouchersModule, UploadsModule, OrdersModule, SizeChartsModule],
  controllers: [
    AdminProductsController,
    AdminCategoriesController,
    AdminVouchersController,
    AdminOrdersController,
    AdminSizeChartsController,
  ],
})
export class AdminModule {}
