import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import * as bodyParser from "body-parser";
import { join } from "path";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/exception.filter";
import { SuspensionGuard } from "./common/guards/suspension.guard";
import { RedisIoAdapter } from "./websockets/redis-io-adapter";

// Ensure BigInt values (from Prisma IDs, etc.) serialize safely in JSON responses
if (!(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

// Initialize Sentry before creating the NestJS app
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Setup Redis adapter for WebSockets (BullMQ queues)
  const redisIoAdapter = new RedisIoAdapter(configService, app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Webhooks Parser - MUST come first and preserve raw buffer
  app.use(
    "/api/stripe/webhook",
    bodyParser.raw({
      type: "application/json",
      verify: (req, res, buf, encoding) => {
        if (buf?.length) {
          // Store both raw buffer for Stripe signature verification
          // and string version for other potential uses
          (req as any).rawBody = buf;
          (req as any).rawBodyString = buf.toString(
            (encoding || "utf8") as BufferEncoding
          );
        }
      },
    })
  );

  // Increase body size limit to 10mb
  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

  // CORS configuration based on environment
  const isProduction = process.env.NODE_ENV === "production";
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")
    : isProduction
      ? []
      : ["http://localhost:3000"];

  app.enableCors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  });

  // Serve static files from public folder
  const publicPath = join(process.cwd(), "public");
  app.useStaticAssets(publicPath, { prefix: "/public/" });

  // Set global prefix
  app.setGlobalPrefix("api");

  // Apply suspension guard globally (before other guards)
  app.useGlobalGuards(new SuspensionGuard(configService));

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Set up global exception filter for error codes
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle("RS Frotas API")
    .setDescription("API do Sistema de Rastreamento e Gestão de Frotas RS Frotas")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  // Start the server
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
