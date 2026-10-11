FROM node:18-alpine AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY services/demo-mcp-servers/inventory-mcp/package.json ./services/demo-mcp-servers/inventory-mcp/
COPY services/demo-mcp-servers/inventory-mcp/tsconfig.json ./services/demo-mcp-servers/inventory-mcp/
RUN npm install --prefix services/demo-mcp-servers/inventory-mcp
COPY services/demo-mcp-servers/inventory-mcp/src ./services/demo-mcp-servers/inventory-mcp/src
WORKDIR /app/services/demo-mcp-servers/inventory-mcp
RUN npx tsc -p tsconfig.json && npm prune --omit=dev

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/demo-mcp-servers/inventory-mcp/package.json ./package.json
COPY --from=build /app/services/demo-mcp-servers/inventory-mcp/dist ./dist
COPY --from=build /app/services/demo-mcp-servers/inventory-mcp/node_modules ./node_modules
USER node
EXPOSE 8083
CMD ["node", "dist/index.js"]

