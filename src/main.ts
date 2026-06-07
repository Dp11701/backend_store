import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:8080')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 8888);
  await app.listen(port);
  console.log(`API http://localhost:${port}/api (CORS: ${corsOrigins.join(', ')})`);
}

bootstrap();
