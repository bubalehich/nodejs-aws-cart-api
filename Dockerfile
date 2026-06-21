# syntax=docker/dockerfile:1.7

# ─── Stage 1: install all deps and build TypeScript ──────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy only manifests first — keeps this layer cacheable when only TS sources change
COPY package*.json ./
RUN npm ci

# Now the sources; tsc reads tsconfig.* but nothing here invalidates the npm install layer
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies so only production node_modules survives into runtime
RUN npm prune --omit=dev

# ─── Stage 2: minimal runtime image ──────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    APP_PORT=4000

# Run as a non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/package.json ./package.json

USER app
EXPOSE 4000

CMD ["node", "dist/main.js"]
