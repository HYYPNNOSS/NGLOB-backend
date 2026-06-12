import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
 
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // needed for Stripe webhook signature validation
  });

  // Serve uploaded files statically
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
 
  // Global prefix
  app.setGlobalPrefix('api');
 
  // Validation pipe — strips unknown fields, validates all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
 
  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL 
      ? [process.env.FRONTEND_URL, 'https://ngob.vercel.app', '*' ,'https://www.nglob.com/','http://localhost:3000'] 
      : ['https://ngob.vercel.app', 'http://localhost:3000'], // Fallback if FRONTEND_URL isn't set
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
 
  // Swagger docs at /api/docs
  const config = new DocumentBuilder()
    .setTitle('Removals API')
    .setDescription('UK removals & storage booking platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
 
  await app.listen(process.env.PORT || 3001);
  console.log(`🚚 Removals API running on port ${process.env.PORT || 3001}`);
  console.log(`📚 Swagger docs: http://localhost:${process.env.PORT || 3001}/api/docs`);
}
bootstrap();
// Trigger restart
