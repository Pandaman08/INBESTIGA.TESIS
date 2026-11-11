import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Soporte para payloads grandes de webhooks de WhatsApp (OpenWA).
  // Se conserva el cuerpo crudo (req.rawBody) para verificar la firma HMAC X-OpenWA-Signature.
  app.use(
    json({
      limit: '50mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 1. Configuración de Prefijo Global
  app.setGlobalPrefix('api/v1');

  // 2. CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 3. Validación DTO Global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 4. Documentación OpenAPI / Swagger
  const config = new DocumentBuilder()
    .setTitle('INBESTIGA.TESIS - API REST')
    .setDescription(
      'Plataforma académica y tecnológica de captación, calificación (Lead Score), negociación con IA, pagos y atención de tesistas según metodología IMPULSE.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_PORT || 4000;
  await app.listen(port);

  logger.log(`===========================================================`);
  logger.log(`🚀 INBESTIGA.TESIS Backend ejecutándose en: http://localhost:${port}`);
  logger.log(`📚 Documentación Swagger disponible en: http://localhost:${port}/api/docs`);
  logger.log(`===========================================================`);
}

bootstrap();
