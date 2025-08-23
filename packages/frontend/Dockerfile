# Use the official Bun image as base
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies for the entire monorepo
FROM base AS deps
# Create a minimal package.json without the book workspace
RUN echo '{"name":"@altitrace/monorepo","private":true,"workspaces":["packages/*"],"packageManager":"bun@1.2.7"}' > package.json
COPY bun.lock ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/sdk/package.json ./packages/sdk/
RUN bun install

# Build the SDK first (required dependency)
FROM deps AS sdk-builder
COPY packages/sdk ./packages/sdk
COPY packages/api/swagger.json ./packages/api/swagger.json
WORKDIR /app/packages/sdk
RUN bun run build

# Build the frontend
FROM deps AS frontend-builder
COPY --from=sdk-builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=sdk-builder /app/packages/sdk/package.json ./packages/sdk/package.json
COPY packages/frontend ./packages/frontend
WORKDIR /app/packages/frontend
RUN bun run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output which includes the entire app structure
COPY --from=frontend-builder --chown=nextjs:nodejs /app/packages/frontend/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /app/packages/frontend/.next/static ./packages/frontend/.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The standalone build creates a server.js in the packages/frontend directory
CMD ["node", "packages/frontend/server.js"]