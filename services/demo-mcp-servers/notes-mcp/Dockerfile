FROM node:18-alpine AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY services/demo-mcp-servers/notes-mcp/package.json ./services/demo-mcp-servers/notes-mcp/
COPY services/demo-mcp-servers/notes-mcp/tsconfig.json ./services/demo-mcp-servers/notes-mcp/
RUN npm install --prefix services/demo-mcp-servers/notes-mcp
COPY services/demo-mcp-servers/notes-mcp/src ./services/demo-mcp-servers/notes-mcp/src
WORKDIR /app/services/demo-mcp-servers/notes-mcp
RUN npx tsc -p tsconfig.json && npm prune --omit=dev

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/demo-mcp-servers/notes-mcp/package.json ./package.json
COPY --from=build /app/services/demo-mcp-servers/notes-mcp/dist ./dist
COPY --from=build /app/services/demo-mcp-servers/notes-mcp/node_modules ./node_modules
USER node
EXPOSE 8082
CMD ["node", "dist/index.js"]

