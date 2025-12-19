# Kafka Connection Fix

## Problem

Kafka connection errors with `connect ECONNREFUSED ::1:9092` because Node.js resolves `localhost` to IPv6 (`::1`) first, but Kafka only listens on IPv4.

## Solution

1. **Updated docker-compose.dev.yml**: Changed `KAFKA_ADVERTISED_LISTENERS` from `localhost:9092` to `127.0.0.1:9092`

2. **Updated src/lib/kafka.ts**: 
   - Added better broker handling
   - Added connection timeouts and retry configuration
   - Made client ID configurable

3. **Updated README**: Changed default `KAFKA_BROKERS` to use `127.0.0.1:9092`

## To Apply Changes

```bash
# Stop and restart Kafka with new configuration
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d

# Verify Kafka is running
docker-compose -f docker-compose.dev.yml ps

# Check Kafka logs
docker-compose -f docker-compose.dev.yml logs kafka
```

## Environment Variables

Update your `.env.local` or environment:

```env
KAFKA_BROKERS=127.0.0.1:9092
```

This ensures the app connects to Kafka using IPv4 instead of trying IPv6 first.
