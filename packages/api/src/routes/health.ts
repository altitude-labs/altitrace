import type { FastifyPluginAsync } from 'fastify';
import { createSuccessResponse } from '@/utils/helpers';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'Health check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                timestamp: { type: 'string' },
                uptime: { type: 'number' },
                version: { type: 'string' },
              },
            },
            timestamp: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const data = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
    };

    reply.send(createSuccessResponse(data, request.id));
  });

  fastify.get('/ready', {
    schema: {
      description: 'Readiness probe',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                ready: { type: 'boolean' },
                checks: {
                  type: 'object',
                  properties: {
                    hyperevm: { type: 'boolean' },
                    database: { type: 'boolean' },
                  },
                },
              },
            },
            timestamp: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Add actual health checks
    const checks = {
      hyperevm: true, // Will implement actual RPC health check
      database: true, // Will implement if we add database
    };

    const data = {
      ready: Object.values(checks).every(check => check),
      checks,
    };

    reply.send(createSuccessResponse(data, request.id));
  });
};

export default healthRoutes;