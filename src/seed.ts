import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeedService } from './seed/seed.service';

async function runSeed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seed = app.get(SeedService);
  const result = await seed.run(true);
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

runSeed();
