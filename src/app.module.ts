import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { SeedModule } from './seed/seed.module';
import { AdminModule } from './admin/admin.module';
import { OrdersModule } from './orders/orders.module';
import { MailModule } from './mail/mail.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI')?.trim();
        if (!uri) {
          throw new Error(
            'MONGODB_URI is missing. Create backend/.env (see env.sample.md) and set a valid connection string.'
          );
        }
        return {
          uri,
          serverSelectionTimeoutMS: 10_000,
        };
      },
    }),
    ProductsModule,
    CategoriesModule,
    VouchersModule,
    SeedModule,
    AdminModule,
    MailModule,
    OrdersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
