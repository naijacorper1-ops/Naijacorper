import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // On Render the app sits behind a proxy. Without this, every request looks like
  // it comes from the proxy's IP, so the rate limiter would treat all users as one.
  if (configService.get<string>('nodeEnv') === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: configService.get<string>('cors.origin'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NaijaCorper API')
    .setDescription('Backend API for the NaijaCorper platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Group endpoints by area (auth, posts, marketplace...) instead of one flat list
  for (const path of Object.keys(document.paths)) {
    const tag = path.replace('/api/v1/', '').split('/')[0];

    for (const operation of Object.values(document.paths[path])) {
      if (operation && typeof operation === 'object' && !Array.isArray(operation)) {
        operation.tags = [tag];
      }
    }
  }

  SwaggerModule.setup('api/docs', app, document);

  const port = configService.getOrThrow<number>('port');
  await app.listen(port);
}

bootstrap();
