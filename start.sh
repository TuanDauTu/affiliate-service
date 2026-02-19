#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "🚀 Starting server..."
node src/server.js
