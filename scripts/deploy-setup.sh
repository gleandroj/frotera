#!/bin/bash

echo "🚀 Setting up production database..."

# Install dependencies
echo "📦 Installing dependencies with Yarn..."
pnpm i

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate --schema apps/api/prisma/schema.prisma

# Push database schema (for new databases)
echo "🗄️ Pushing database schema..."
npx prisma db push --accept-data-loss --schema apps/api/prisma/schema.prisma

# Seed database
echo "🌱 Seeding database..."
pnpm --filter=api prisma:seed

# Or run migrations (for existing databases)
# npx prisma migrate deploy

echo "✅ Database setup complete!"
