FROM node:18-alpine AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY services/woocommerce-mcp/package.json ./services/woocommerce-mcp/
COPY services/woocommerce-mcp/tsconfig.json ./services/woocommerce-mcp/
RUN npm install --prefix services/woocommerce-mcp
COPY services/woocommerce-mcp/src ./services/woocommerce-mcp/src
WORKDIR /app/services/woocommerce-mcp
RUN npx tsc -p tsconfig.json && npm prune --omit=dev

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/woocommerce-mcp/package.json ./package.json
COPY --from=build /app/services/woocommerce-mcp/dist ./dist
COPY --from=build /app/services/woocommerce-mcp/node_modules ./node_modules
USER node
EXPOSE 8081
CMD ["node", "dist/index.js"]

