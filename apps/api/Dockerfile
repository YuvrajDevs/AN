# syntax=docker/dockerfile:1
# Build context: repository root (npm workspaces).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN npm ci --workspace apps/api --include-workspace-root=false --ignore-scripts --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN npm ci --workspace apps/api --include-workspace-root=false --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Root and workspace-level node_modules (npm nests version-conflicting deps per workspace).
COPY --from=prod-deps /app ./
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/eval ./apps/api/eval
COPY data/seed ./data/seed
WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "dist/server.js"]
