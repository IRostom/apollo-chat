# =============================================================================
# Stage 1: Build the Vue.js application
# =============================================================================
# Using Node 22 Alpine for smaller image size
FROM node:22-alpine AS build

# Install pnpm globally
# pnpm is faster and more disk-efficient than npm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory inside container
WORKDIR /app

# Copy workspace configuration files first
# This allows Docker to cache the dependency installation layer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy only the package.json files needed for dependency resolution
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
# --frozen-lockfile ensures reproducible builds (fails if lockfile is outdated)
RUN pnpm install --frozen-lockfile

# Now copy the actual source code
# This is separate so code changes don't invalidate the dependency cache
COPY apps/frontend/ ./apps/frontend/

# Build the Vue application
# This creates static files in apps/frontend/dist/
# Set the API base URL to use /api which nginx will proxy to backend
ENV VITE_API_BASE_URL=/api
RUN pnpm --filter @apollo-chat/frontend build

# =============================================================================
# Stage 2: Serve with nginx
# =============================================================================
# Using nginx Alpine for minimal image size (~25MB)
FROM nginx:alpine AS production

# Copy our custom nginx configuration
COPY apps/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy the built static files from the build stage
# nginx serves files from /usr/share/nginx/html by default
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

# Expose port 80 (standard HTTP port)
EXPOSE 80

# nginx runs in foreground by default with this config
CMD ["nginx", "-g", "daemon off;"]
