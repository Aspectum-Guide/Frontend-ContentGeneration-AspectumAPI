# Multi-stage Dockerfile for frontend (Vite/React)
# Stage 1: build
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci --legacy-peer-deps --silent || npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN chmod +x /docker-entrypoint.d/40-app-config.sh
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
