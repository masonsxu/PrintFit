FROM docker.io/oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app

COPY . .
RUN bun run build

FROM docker.io/library/nginx:1.29-alpine AS runtime
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80
