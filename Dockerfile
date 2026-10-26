FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
FROM dependencies AS build
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 MIKRO_ORM_CLI_PREFER_TS=false
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3002
CMD ["node", "dist/main.js"]
