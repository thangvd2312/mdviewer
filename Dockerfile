# syntax=docker/dockerfile:1
# mdviewer: NestJS API + React (frontend/dist) trong 1 process. Build context = thư mục gốc repo mdviewer.
FROM node:22-bookworm-slim AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS api
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4100
WORKDIR /app/backend
COPY --from=api /app/backend/package.json ./
COPY --from=api /app/backend/node_modules ./node_modules
COPY --from=api /app/backend/dist ./dist
COPY --from=web /app/frontend/dist /app/frontend/dist
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
USER node
EXPOSE 4100
# Migration TypeORM tự chạy khi khởi động (DB_MIGRATIONS_RUN=true)
CMD ["node", "dist/main.js"]
