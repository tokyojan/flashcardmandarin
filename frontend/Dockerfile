FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY serve.ts ./
RUN npm init -y > /dev/null 2>&1 && npm install hono @hono/node-server tsx > /dev/null 2>&1
EXPOSE 3888
CMD ["npx", "tsx", "serve.ts"]
