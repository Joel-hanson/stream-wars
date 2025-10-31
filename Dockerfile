FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js application (with standalone output) and compile server
RUN npm run build
RUN npm run build:server

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone Next.js output (includes only necessary node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the compiled JavaScript server files and source lib files
COPY --from=builder /app/dist ./dist

# Copy package.json for module resolution
COPY --from=builder /app/package.json ./package.json

# Copy the entrypoint script
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Make entrypoint executable
RUN chmod +x ./docker-entrypoint.sh

# Set the correct permission for prerender cache
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000 3001

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV WS_PORT=3001

# Use the entrypoint script to run both servers
CMD ["./docker-entrypoint.sh"]
