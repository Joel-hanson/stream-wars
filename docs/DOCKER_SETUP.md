# Docker Setup for Stream Wars

## Overview

The Docker setup runs both the Next.js application and the WebSocket server in a single container.

## Architecture

```
Docker Container
├── Next.js App (Port 3000)
└── WebSocket Server (Port 3001)
```

## Building

```bash
docker build -t stream-wars .
```

## Running with Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Access Points

- **Next.js App**: http://localhost:3000
- **WebSocket Server**: ws://localhost:3001
- **Kafka UI**: http://localhost:8080

## Environment Variables

- `NODE_ENV=production`
- `KAFKA_BROKERS=kafka:9092`
- `NEXT_PUBLIC_WS_URL=ws://localhost:3001`
- `WS_PORT=3001`

## Entrypoint

The `docker-entrypoint.sh` script runs both servers:
1. Next.js server (compiled JavaScript)
2. WebSocket server (TypeScript via tsx)

If either server crashes, both are terminated.
