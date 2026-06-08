# syntax=docker/dockerfile:1

# ---- deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app
# sharp on Alpine needs libvips headers at install time so npm can either
# link the prebuilt musl binary against system vips or build from source.
RUN apk add --no-cache vips-dev
COPY package.json package-lock.json ./
# --ignore-scripts: sharp's install tries to build from source on Alpine;
# prebuilt musl binaries ship with the package and load at runtime via libvips.
RUN npm ci --omit=dev --ignore-scripts

# ---- builder stage ----
FROM node:20-alpine AS builder
WORKDIR /app
# Same vips requirement as the deps stage for the full dev install + build.
RUN apk add --no-cache vips-dev
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Generate Prisma client before build
RUN npx prisma generate
# Compile seed script to plain JS (no tsx needed at runtime)
RUN npx tsc prisma/seed.ts --outDir prisma-compiled --esModuleInterop --target ES2020 --module commonjs --skipLibCheck --moduleResolution node
# Build Next.js
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG DATABASE_URL
RUN npm run build

# ---- runner stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install runtime deps: OpenSSL (Prisma) + libvips (sharp at runtime)
RUN apk add --no-cache openssl vips

# Copy built output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files needed at runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder /app/prisma-compiled ./prisma-compiled

# Uploads directory
RUN mkdir -p /app/public/uploads && chown nextjs:nodejs /app/public/uploads

# Pre-warm Prisma engines location so non-root user can write
RUN mkdir -p /app/node_modules/@prisma/engines && chown nextjs:nodejs /app/node_modules/@prisma/engines

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
