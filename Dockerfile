FROM node:22-alpine AS frontend

WORKDIR /app/front

COPY front/package.json front/package-lock.json ./
RUN npm ci

COPY front ./
RUN npm run build

FROM golang:1.25-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=frontend /app/front/out ./front/out
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server .

FROM alpine:3.22

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /out/server /app/server
COPY schema.sql /app/schema.sql

ENV PORT=8080

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1

USER app

CMD ["/app/server"]
