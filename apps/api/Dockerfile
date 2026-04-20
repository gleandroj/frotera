FROM node:22-alpine AS base
# OpenSSL required by Prisma on Alpine
RUN apk add --no-cache openssl libc6-compat && \
    corepack enable && corepack prepare pnpm@8.15.4 --activate

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @gleandroj/shared build
RUN NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter api build

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only (skips postinstall; prisma generate runs below)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy compiled artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/public ./apps/api/public

# Generate Prisma client against the installed engine
RUN cd apps/api && pnpm exec prisma generate --schema=./prisma/schema.prisma

EXPOSE 3001
# Set CWD to app dir so process.cwd() resolves paths (public/, etc.) correctly
WORKDIR /app/apps/api
CMD ["node", "dist/main"]
