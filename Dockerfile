FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY src/ ./src/

RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY update-db.sh ./
COPY start.sh ./
COPY start-prod.sh ./

RUN mkdir -p data && chown node:node data

EXPOSE 7755

USER node

CMD ["node", "dist/server.js"]