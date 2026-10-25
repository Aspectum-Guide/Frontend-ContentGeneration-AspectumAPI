# Multi-stage Dockerfile for frontend (Vite/React)
# The UI kit is a git submodule (packages/admin-ui-web, an npm workspace):
# clone with --recurse-submodules or run `git submodule update --init` before building.
# Stage 1: build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
RUN test -f packages/admin-ui-web/package.json \
    || (echo "UI kit submodule is missing: run 'git submodule update --init'" >&2; exit 1)
RUN npm ci --silent
COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
