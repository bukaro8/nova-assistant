FROM node:22.13.1-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22.13.1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN DATABASE_URL="postgresql://nova:nova_password@localhost:5432/nova?schema=public" npm run build

FROM node:22.13.1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated

RUN npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "run", "start"]
