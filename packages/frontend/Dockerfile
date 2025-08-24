# Use Node.js as base
FROM node:18-alpine AS base
WORKDIR /app

# Install Bun for package management
RUN npm install -g bun@1.2.7

# Install dependencies for the entire monorepo
FROM base AS deps

RUN echo '{"name":"@altitrace/monorepo","private":true,"workspaces":["packages/*"],"packageManager":"bun@1.2.7"}' > package.json
COPY bun.lock ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/frontend/scripts ./packages/frontend/scripts
COPY packages/frontend/public ./packages/frontend/public

RUN bun install

# Build the SDK first (required dependency)
FROM deps AS sdk-builder
COPY packages/sdk ./packages/sdk
COPY packages/api/swagger.json ./packages/api/swagger.json
WORKDIR /app/packages/sdk
RUN npm run build

# Build the frontend
FROM deps AS frontend-builder
COPY --from=sdk-builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=sdk-builder /app/packages/sdk/package.json ./packages/sdk/package.json
COPY packages/frontend ./packages/frontend
WORKDIR /app/packages/frontend

# Set environment variables for build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG INTERNAL_API_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL

RUN npm run build

# Production image
FROM node:18-alpine AS runner
WORKDIR /app/packages/frontend

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs


COPY --from=frontend-builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=frontend-builder --chown=nextjs:nodejs /app/packages/frontend/.next ./.next
COPY --from=frontend-builder --chown=nextjs:nodejs /app/packages/frontend/next.config.js ./next.config.js
COPY --from=frontend-builder --chown=nextjs:nodejs /app/packages/frontend/package.json ./package.json

COPY --from=frontend-builder --chown=nextjs:nodejs /app/packages/frontend/public ./public

# Copy SDK dist (needed at runtime)
COPY --from=sdk-builder --chown=nextjs:nodejs /app/packages/sdk/dist ../sdk/dist

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]