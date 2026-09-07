FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY nest-cli.json tsconfig*.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# Prisma's config validates DATABASE_URL even when only generating the client.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public
RUN npm run db:generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health/live').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
