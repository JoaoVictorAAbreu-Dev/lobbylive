FROM node:24-bookworm-slim AS build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --ignore-scripts
COPY web ./
COPY src/realtime/contracts.ts /app/src/realtime/contracts.ts
RUN npm run build
FROM nginx:stable-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
