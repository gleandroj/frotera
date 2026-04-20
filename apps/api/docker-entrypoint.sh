#!/bin/sh
set -e

echo "[entrypoint] Pushing database schema..."
npx prisma db push --schema=./prisma/schema.prisma --skip-generate

echo "[entrypoint] Running seed..."
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
  node -r ts-node/register prisma/seed.ts

echo "[entrypoint] Starting API..."
exec "$@"
