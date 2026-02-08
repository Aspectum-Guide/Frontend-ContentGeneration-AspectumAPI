# Multi-stage Dockerfile for frontend (Vite/React/vue)
# Stage 1: build
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci --silent || npm install
COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
