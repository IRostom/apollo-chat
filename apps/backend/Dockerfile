# =============================================================================
# Stage 1: Build the TypeScript application
# =============================================================================
FROM node:22-alpine AS build

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration files first (for dependency caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy backend package.json for dependency resolution
COPY apps/backend/package.json ./apps/backend/

# Install ALL dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Copy backend source code
COPY apps/backend/ ./apps/backend/

# Build TypeScript to JavaScript
# This runs: tsc && cp src/services/*.py dist/services/
WORKDIR /app/apps/backend
RUN pnpm run build:ts

# =============================================================================
# Stage 2: Production image
# =============================================================================
FROM node:22-alpine AS production

# Install pnpm for running drizzle-kit in entrypoint
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy backend package.json
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies (including devDependencies for drizzle-kit)
# drizzle-kit is needed for database migrations at runtime
RUN pnpm install --frozen-lockfile

# Copy built JavaScript files from build stage
COPY --from=build /app/apps/backend/dist ./apps/backend/dist

# Copy drizzle config and schema (needed for migrations)
COPY apps/backend/drizzle.config.ts ./apps/backend/
COPY apps/backend/src/db/schema.ts ./apps/backend/src/db/

# Copy entrypoint script
COPY apps/backend/entrypoint.sh ./apps/backend/

# Make entrypoint executable
RUN chmod +x ./apps/backend/entrypoint.sh

# Create data directory for database (will be mounted as volume)
RUN mkdir -p /app/data

# Create uploads directory (will be mounted as volume)
# This path matches where the backend expects uploads relative to dist/
RUN mkdir -p /app/apps/backend/uploads

WORKDIR /app/apps/backend

# Expose port 3000 (only accessible within Docker network)
EXPOSE 3000

# Use entrypoint script to run migrations before starting server
ENTRYPOINT ["./entrypoint.sh"]
