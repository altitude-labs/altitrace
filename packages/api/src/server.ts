import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { generateRequestId, createSuccessResponse } from '@/utils/helpers';
import { sendErrorResponse } from '@/utils/errors';

// Import routes
import healthRoutes from '@/routes/health';
import simulateRoutes from '@/routes/simulate';

const fastify = Fastify({
  logger: true,
  genReqId: generateRequestId,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
});

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  const requestId = request.id;
  fastify.log.error({ error, requestId }, 'Unhandled error');
  sendErrorResponse(reply, error, requestId);
});

// Global not found handler
fastify.setNotFoundHandler((request, reply) => {
  const requestId = request.id;
  reply.code(404).send(createSuccessResponse(
    { message: `Route ${request.method} ${request.url} not found` },
    requestId
  ));
});

async function buildServer() {
  try {
    // Security middleware
    await fastify.register(helmet, {
      contentSecurityPolicy: false, // Disable for Swagger UI
    });

    await fastify.register(cors, {
      origin: env.NODE_ENV === 'development' ? true : ['https://altitrace.dev'],
      credentials: true,
    });

    // Rate limiting
    await fastify.register(rateLimit, {
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW,
      keyGenerator: (request) => {
        // Use API key if present, otherwise IP
        return request.headers[env.API_KEY_HEADER] as string || request.ip;
      },
    });

    // API Documentation - auto-generated from route schemas
    await fastify.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'AltiTrace API',
          description: 'HyperEVM Transaction Simulation Platform API',
          version: '0.1.0',
          contact: {
            name: 'AltiTrace Team',
            url: 'https://altitrace.dev',
          },
          license: {
            name: 'MIT',
          },
        },
        servers: [
          {
            url: `http://localhost:${env.PORT}`,
            description: 'Development server',
          },
          {
            url: 'https://api.altitrace.dev',
            description: 'Production server',
          },
        ],
        components: {
          securitySchemes: {
            apiKey: {
              type: 'apiKey',
              name: env.API_KEY_HEADER,
              in: 'header',
              description: 'API key for authentication',
            },
          },
        },
        tags: [
          {
            name: 'Health',
            description: 'Health check and readiness endpoints',
          },
          {
            name: 'Simulation',
            description: 'Transaction simulation endpoints',
          },
          {
            name: 'Gas',
            description: 'Gas estimation endpoints',
          },
        ],
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });

    // Global hooks
    fastify.addHook('onRequest', async (request) => {
      request.log.info({ method: request.method, url: request.url }, 'Request started');
    });

    fastify.addHook('onResponse', async (request, reply) => {
      request.log.info(
        { 
          method: request.method, 
          url: request.url, 
          statusCode: reply.statusCode,
          responseTime: reply.getResponseTime(),
        }, 
        'Request completed'
      );
    });

    // API key validation (if required)
    if (env.REQUIRE_API_KEY) {
      fastify.addHook('onRequest', async (request, reply) => {
        const apiKey = request.headers[env.API_KEY_HEADER];
        if (!apiKey) {
          reply.code(401).send({
            success: false,
            error: {
              code: 'MISSING_API_KEY',
              message: `API key required in ${env.API_KEY_HEADER} header`,
            },
            timestamp: new Date().toISOString(),
            requestId: request.id,
          });
        }
      });
    }

    // Register routes
    await fastify.register(healthRoutes, { prefix: '/health' });
    await fastify.register(simulateRoutes, { prefix: '/api/v1' });

    return fastify;
  } catch (error) {
    fastify.log.error(error, 'Failed to build server');
    process.exit(1);
  }
}

async function start() {
  try {
    const server = await buildServer();
    
    await server.listen({
      host: env.HOST,
      port: env.PORT,
    });

    server.log.info(
      { 
        port: env.PORT, 
        host: env.HOST, 
        environment: env.NODE_ENV,
        docs: `http://${env.HOST}:${env.PORT}/docs`,
      }, 
      '🚀 AltiTrace API server started'
    );

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        server.log.info(`Received ${signal}, shutting down gracefully...`);
        await server.close();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

// Start server if this file is run directly  
if (require.main === module) {
  start();
}

export { buildServer, start };