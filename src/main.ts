import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  // const app = await NestFactory.create(AppModule);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  // Cấu hình CORS
  app.enableCors({
    origin: 'http://192.168.68.99:3000', // Origin của frontend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Cấu hình phục vụ file tĩnh
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/', // Đường dẫn truy cập file qua URL
  });
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
