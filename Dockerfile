# --- STAGE 1: Build Shared and Backend ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install root dependencies
RUN npm install --workspace=@gatigo/shared --workspace=@gatigo/backend

# Copy source code
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared package
WORKDIR /app/shared
RUN npm run build

# Build backend
WORKDIR /app/backend
RUN npm run prisma:generate || true
RUN npm run build

# --- STAGE 2: Production Runner ---
FROM node:20-alpine AS runner

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=5000

# Copy shared build artifacts
COPY --from=builder /app/shared/dist /app/shared/dist
COPY --from=builder /app/shared/package.json /app/shared/package.json

# Copy backend build artifacts
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/backend/prisma ./prisma

# Install production dependencies only
RUN npm install --omit=dev

EXPOSE 5000

CMD ["node", "dist/main.js"]
