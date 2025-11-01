# Redis State Management Implementation

## Overview

The application has been refactored to use **Redis for centralized state management** and **Kafka for event streaming**. This architecture ensures consistent state across restarts and provides a scalable, persistent solution.

## Architecture Changes

### Before (In-Memory State)
- Game state stored in WebSocket server memory
- State lost on every restart
- Inconsistent counts across restarts
- No persistence

### After (Redis + Kafka)
- **Redis**: Centralized persistent state storage
- **Kafka**: Event streaming for tap events
- State persists across restarts
- Consistent counts and leaderboards
- Scalable architecture

## New Components

### 1. Redis Client (`src/lib/redis.ts`)

A comprehensive Redis client utility that provides:

#### State Management Functions
- `getGameState()` - Fetch current game state
- `addUser(user)` - Add a user to the game
- `getUser(userId)` - Get a specific user
- `getAllUsers()` - Get all active users
- `removeUser(userId)` - Remove a user from the game
- `incrementUserTaps(userId)` - Increment user tap count and update scores
- `getLeaderboard(limit)` - Get top players
- `balanceTeamAssignment()` - Balance teams based on current state
- `resetGameState()` - Reset all game state (admin/testing)

#### Redis Keys Structure
```typescript
REDIS_KEYS = {
  USERS: 'game:users',                    // Hash: userId -> User JSON
  TEAM_BLUE_SCORE: 'game:team:blue:score', // String: Blue team score
  TEAM_RED_SCORE: 'game:team:red:score',   // String: Red team score
  TOTAL_TAPS: 'game:total:taps',           // String: Total taps count
}
```

### 2. Updated WebSocket Server (`src/lib/websocket-server.ts`)

**Key Changes:**
- Removed in-memory `gameState` and `users` maps
- All state operations now go through Redis
- Methods are now async
- Connects to Redis on startup

**Flow:**
1. Client connects → Send initial state from Redis
2. User joins → Store in Redis → Broadcast update
3. User leaves → Remove from Redis → Broadcast update
4. State updates → Fetch from Redis → Broadcast to clients

### 3. Updated Kafka Consumer (`src/lib/kafka-consumer.ts`)

**Key Changes:**
- Consumes tap events from Kafka
- Updates Redis state (not in-memory)
- Broadcasts updates via WebSocket

**Flow:**
```
Tap Event (Kafka) 
  → incrementUserTaps(userId) (Redis)
  → broadcastGameUpdate(updatedUser) (WebSocket)
  → All clients receive update
```

### 4. Updated API Routes (`src/app/api/game-state/route.ts`)

**Key Changes:**
- Fetches state directly from Redis
- No more WebSocket server HTTP calls
- Faster and more reliable

## Data Flow

### User Tap Flow
```mermaid
Client (Tap) 
  → API (/api/tap)
  → Kafka (GAME_TAPS topic)
  → Kafka Consumer
  → Redis (increment tap count + scores)
  → WebSocket Broadcast
  → All Clients (receive update)
```

### User Join Flow
```mermaid
Client (Connect) 
  → WebSocket Server
  → Redis (add user, balance teams)
  → Broadcast to all clients
```

### State Fetch Flow
```mermaid
Client Request 
  → API (/api/game-state)
  → Redis (fetch state, users, leaderboard)
  → Return to client
```

## Configuration

### Environment Variables

Add to your `.env.local` or docker-compose:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# For Docker
REDIS_URL=redis://redis:6379
```

### Docker Compose

Redis is already configured in `docker-compose.dev.yml`:

```yaml
redis:
  image: redis:7-alpine
  container_name: redis
  ports:
    - "6379:6379"
  command: redis-server --appendonly yes
  volumes:
    - redis_data:/data
```

## Running the Application

### With Docker (Recommended)

```bash
# Start all services (Next.js, WebSocket, Kafka, Redis)
docker-compose -f docker-compose.dev.yml up

# Or with npm (if not using Docker)
npm run dev
```

### Services Startup Order

1. **Redis** starts first
2. **Kafka** starts second
3. **WebSocket Server** connects to Redis, then Kafka
4. **Next.js App** connects to Redis, then Kafka

## Benefits

### 1. **Persistence**
- State survives application restarts
- No data loss on crashes
- Consistent counts across deployments

### 2. **Scalability**
- Multiple WebSocket servers can share Redis state
- Horizontal scaling capability
- Load balancing ready

### 3. **Consistency**
- Single source of truth (Redis)
- No state drift between instances
- Accurate leaderboards and scores

### 4. **Performance**
- Fast in-memory operations (Redis)
- Efficient pub/sub via Kafka
- Optimized data structures

### 5. **Debugging**
- Easy to inspect state via Redis CLI
- Clear event stream via Kafka
- Separate concerns (state vs events)

## Redis CLI Commands

Useful commands for debugging:

```bash
# Connect to Redis
redis-cli

# View all users
HGETALL game:users

# Get specific user
HGET game:users <userId>

# View team scores
GET game:team:blue:score
GET game:team:red:score

# View total taps
GET game:total:taps

# Count active users
HLEN game:users

# Clear all game state (careful!)
DEL game:users game:team:blue:score game:team:red:score game:total:taps
```

## Testing the Implementation

### 1. Start the services
```bash
docker-compose -f docker-compose.dev.yml up
```

### 2. Open multiple browser windows
Navigate to `http://localhost:3000` in 2-3 browser tabs

### 3. Test taps
- Click the tap button in each window
- Verify counts update in real-time across all windows

### 4. Test persistence
```bash
# Restart the app
docker-compose -f docker-compose.dev.yml restart app

# Refresh browser - scores should persist!
```

### 5. Monitor Redis
```bash
# In another terminal
docker exec -it redis redis-cli

# Watch keys
KEYS game:*

# Monitor commands
MONITOR
```

## Troubleshooting

### Redis Connection Issues

```bash
# Check Redis is running
docker ps | grep redis

# Check Redis logs
docker logs redis

# Test Redis connection
docker exec -it redis redis-cli PING
# Should return: PONG
```

### State Not Persisting

```bash
# Verify Redis is using AOF persistence
docker exec -it redis redis-cli CONFIG GET appendonly
# Should return: "appendonly" "yes"

# Check Redis data directory
docker exec -it redis ls -la /data
```

### Counts Still Wrong

```bash
# Reset game state
docker exec -it redis redis-cli

# In Redis CLI:
DEL game:users
DEL game:team:blue:score
DEL game:team:red:score
DEL game:total:taps
EXIT

# Restart app
docker-compose -f docker-compose.dev.yml restart app
```

## Migration Notes

### From Old In-Memory System

1. **No migration needed** - Old state was not persistent
2. **Fresh start** - Redis starts with clean state
3. **Users re-join** - Users will get new team assignments on next visit

## Future Enhancements

### Potential Improvements

1. **Redis Pub/Sub** - Replace WebSocket broadcasting with Redis pub/sub
2. **Redis Streams** - Use Redis Streams instead of Kafka for simpler deployment
3. **Caching Layer** - Add read caching for frequently accessed data
4. **Analytics** - Store historical data for analytics
5. **Admin Dashboard** - Create admin interface to manage state
6. **Backup/Restore** - Implement Redis backup strategies
7. **Clustering** - Add Redis cluster for high availability

## Summary

✅ **Implemented:**
- Redis for persistent state storage
- Kafka for event streaming
- Updated WebSocket server to use Redis
- Updated API routes to use Redis
- Updated Kafka consumer to update Redis
- Environment configuration
- No linting errors

✅ **Benefits:**
- State persists across restarts
- Consistent counts
- Scalable architecture
- Clear separation of concerns

✅ **Ready for Production:**
- Docker-ready
- Environment-agnostic
- Fault-tolerant
- Easy to monitor and debug

The application is now production-ready with a robust, scalable state management system! 🚀

