FROM node:20-alpine AS builder

WORKDIR /app

COPY ./apps/sentry-aegis-ai/package.json ./

RUN npm install

COPY . .

RUN npm run build --prefix apps/sentry-aegis-ai


FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY ./apps/sentry-aegis-ai/package.json ./

RUN npm prune --production

COPY --from=builder /app/apps/sentry-aegis-ai ./apps/sentry-aegis-ai

EXPOSE 3001

CMD ["node", "apps/sentry-aegis-ai/dist/index.js"]