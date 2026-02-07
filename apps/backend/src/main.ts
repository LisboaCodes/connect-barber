import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Connect Barber API')
    .setDescription('Sistema completo de gestão para barbearias')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticação e OAuth')
    .addTag('tenants', 'Gestão de barbearias')
    .addTag('users', 'Gestão de usuários')
    .addTag('appointments', 'Agendamentos')
    .addTag('services', 'Serviços oferecidos')
    .addTag('cashier', 'Caixa e transações')
    .addTag('products', 'Produtos e estoque')
    .addTag('reports', 'Relatórios')
    .addTag('notifications', 'Notificações')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
