FROM node:18-alpine AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY services/gateway/package.json ./services/gateway/
COPY services/gateway/tsconfig.json ./services/gateway/
RUN npm install --prefix services/gateway
COPY services/gateway/src ./services/gateway/src
COPY services/gateway/migrations ./services/gateway/migrations
WORKDIR /app/services/gateway
RUN npx tsc -p tsconfig.json && npm prune --omit=dev

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/gateway/package.json ./package.json
COPY --from=build /app/services/gateway/dist ./dist
COPY --from=build /app/services/gateway/node_modules ./node_modules
COPY --from=build /app/services/gateway/migrations ./migrations
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]

