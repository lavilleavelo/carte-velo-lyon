FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm -g i corepack && corepack enable
RUN pnpm i
COPY . .
RUN pnpm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]

