# Game State Fix

## Problem
Game state indicators (active players, total taps, leaderboard) were showing as empty even though tap events were being produced to Kafka successfully.

## Root Causes

### 1. **Wrong WebSocket Server Instance**
- The application had TWO separate WebSocket server instances:
  - `gameWebSocketServer` in `src/lib/websocket.ts`
  - `standaloneWebSocketServer` in `src/lib/websocket-server.ts`
- Clients connected to `standaloneWebSocketServer` on port 3001
- But Kafka consumer was trying to update users in `gameWebSocketServer`
- These were different instances with different user lists, so updates failed

### 2. **User ID Mapping Issue**
- Users were being stored with WebSocket clientId instead of their actual userId
- Tap events contained the user's original ID
- When Kafka consumer looked up users by ID, it couldn't find them

### 3. **Missing Kafka Consumer in WebSocket Process**
- The Kafka consumer needed to run in the same process as the WebSocket server
- This ensures they share the same user state

## Solutions Applied

### 1. Updated Kafka Consumer (`src/lib/kafka-consumer.ts`)
- Changed from using `gameWebSocketServer` to `standaloneWebSocketServer`
- Added better logging to track when users are not found
- Added tap count logging for debugging

### 2. Fixed User ID Mapping (`src/lib/websocket-server.ts`)
- Added `clientToUserId` map to track WebSocket client ID to user ID relationship
- Store users by their actual userId, not the WebSocket clientId
- Updated `addUser()` to use the user's provided ID
- Updated `removeUser()` to look up userId from clientId first
- Added logging for user add/remove events

### 3. Integrated Kafka with WebSocket Server (`websocket-server.ts`)
- Initialize Kafka when WebSocket server starts
- Start Kafka consumer in the same process
- This ensures shared state between WebSocket connections and Kafka events

## How It Works Now

1. User loads the page → generates a userId
2. User connects to WebSocket → sends userId in join message
3. WebSocket server stores user with their actual userId (not clientId)
4. User taps → sends tap event to Kafka with their userId
5. Kafka consumer receives tap → looks up user by userId
6. Updates user's tap count and broadcasts to all clients
7. All clients see updated game state

## Testing Steps

1. Restart both servers:
   ```bash
   npm run dev
   ```

2. Open the application in browser
3. Check console logs for:
   - User added with ID and team
   - Tap events being processed with correct userId
   - Game state updates being broadcast

4. Verify in UI:
   - Active Players count increases
   - Total Taps count increases
   - Team scores increase based on taps
   - Leaderboard shows users with tap counts

