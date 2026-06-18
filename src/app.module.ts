import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { SeedModule } from './seed/seed.module';
import { AdminModule } from './admin/admin.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { SizeChartsModule } from './size-charts/size-charts.module';
import { StylistModule } from './stylist/stylist.module';
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
    SizeChartsModule,
    VouchersModule,
    SeedModule,
    AdminModule,
    MailModule,
    NewsletterModule,
    UsersModule,
    AuthModule,
    OrdersModule,
    StylistModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
