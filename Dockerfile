# 1) deps
FROM node:20-alpine AS deps
WORKDIR /app

# runtime deps
RUN apk add --no-cache openssl

COPY nextjs/package*.json ./
RUN npm ci

# 2) builder
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY nextjs .

# Next build
RUN npm run build

# 3) runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Next output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
