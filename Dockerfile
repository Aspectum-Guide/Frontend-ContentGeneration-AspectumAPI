# Multi-stage Dockerfile for frontend (Vite/React/vue)
# Stage 1: build
FROM node:18-alpine AS build
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
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
