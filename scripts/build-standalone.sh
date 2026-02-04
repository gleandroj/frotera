#!/bin/bash
set -e

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Clean and prepare the build
echo "Cleaning previous builds..."
rm -rf apps/web/.next
rm -rf apps/web/out

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build the project
echo "Building project..."
pnpm turbo run build --filter=web...

# Ensure the standalone directory exists
echo "Preparing standalone build..."
mkdir -p ./standalone-build

# Copy necessary files for standalone build
echo "Copying standalone files..."
cp apps/web/next.config.ts ./standalone-build/
cp apps/web/package.json ./standalone-build/

# Copy the standalone build
cp -r apps/web/.next/standalone/* ./standalone-build/
cp -r apps/web/.next/static ./standalone-build/apps/web/.next/static
cp -r apps/web/public ./standalone-build/apps/web/public

# Copy translation files
echo "Copying translation files..."
mkdir -p ./standalone-build/apps/web/i18n/locales
cp -r apps/web/i18n/locales/* ./standalone-build/apps/web/i18n/locales/

cd ./standalone-build/apps/web
pnpm install

echo "Build completed successfully!"
echo "Standalone build is available in ./standalone-build"
