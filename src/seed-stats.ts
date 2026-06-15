import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeedService } from './seed/seed.service';

async function runStatsSeed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seed = app.get(SeedService);
  const result = await seed.randomizeProductStats();
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

runStatsSeed();
