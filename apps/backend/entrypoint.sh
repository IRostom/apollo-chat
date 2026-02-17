#!/bin/sh
# =============================================================================
# Backend Entrypoint Script
# =============================================================================
# This script runs every time the container starts.
# It ensures the database schema is up-to-date before starting the server.

set -e  # Exit immediately if any command fails

echo "🚀 Starting Apollo Chat Backend..."

# =============================================================================
# Step 1: Run Database Migrations
# =============================================================================
# Applies committed SQL migrations in ./drizzle to keep the
# database schema consistent across environments.
echo "📦 Running database migrations..."
node dist/db/migrate.js

echo "✅ Database migrations complete!"

# =============================================================================
# Step 2: Start the Node.js Server
# =============================================================================
# 'exec' replaces this shell process with the Node process
# This is important for Docker because:
# - Signals (SIGTERM, SIGINT) go directly to Node
# - Enables graceful shutdown
# - Node becomes PID 1 in the container
echo "🌐 Starting server..."
exec node dist/server.js
