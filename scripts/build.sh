#!/bin/bash

# Install dependencies with Yarn
pnpm install

# Generate Prisma client
npx prisma generate

# Build the application
pnpm build
