# Multi-stage build for frontend with optimizations
FROM node:20-alpine as builder

WORKDIR /app

# Set build environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./

# Install dependencies with cache optimization
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage: Alpine with minimal dependencies
FROM node:20-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./

# Install production dependencies only
RUN npm ci --omit=dev --prefer-offline --no-audit && npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --chown=nextjs:nodejs next.config.ts ./

# Set environment variables for optimization
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=512

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Run the application with optimized settings
CMD ["npm", "start"]
