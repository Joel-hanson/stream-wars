# User Metadata Feature

## Overview

This feature captures and streams user metadata (browser information, OS, device type, IP address, etc.) to a separate Kafka topic when users connect to the WebSocket server.

## Architecture

### Components Added

1. **Kafka Topic**: `user-metadata` - A dedicated Kafka topic for user metadata events
2. **Type Definitions**: `UserMetadataEvent` - Type definition for user metadata events
3. **Producer Service**: `kafka-producer-metadata.ts` - Service to publish metadata to Kafka
4. **Consumer Example**: `kafka-consumer-metadata.ts` - Example consumer implementation
5. **WebSocket Enhancement**: Modified to capture connection metadata

## What Metadata is Captured?

When a user connects, the following information is captured and sent to Kafka:

- **User Information**
  - User ID
  - Username
  - Session ID
  
- **Browser Information**
  - Browser name and version (e.g., "Chrome 120.0")
  - User Agent string
  
- **System Information**
  - Operating System (e.g., "Windows 10", "macOS 14.2", "Android 13")
  - Device type (Desktop, Mobile, or Tablet)
  - Language preferences
  
- **Connection Information**
  - Client ID
  - IP Address
  - Connection timestamp

## How It Works

### 1. User Connects to WebSocket

When a user connects via WebSocket:
```typescript
// WebSocket captures HTTP request headers
const userAgent = req.headers['user-agent'];
const ip = req.socket.remoteAddress;
const language = req.headers['accept-language'];
```

### 2. User Agent Parsing

The `parseUserAgent()` function extracts:
- Browser name and version
- Operating system
- Device type

### 3. Metadata Event Creation

When user joins:
```typescript
const metadataEvent: UserMetadataEvent = {
  id: generateId(),
  userId: user.id,
  username: user.username,
  sessionId: user.sessionId,
  timestamp: Date.now(),
  metadata: user.meta || {},
  connectionInfo: {
    clientId,
    ipAddress: connectionMetadata?.ip,
    connectionTime: Date.now(),
  },
};
```

### 4. Published to Kafka

The event is published to the `user-metadata` topic:
```typescript
await publishUserMetadata(metadataEvent);
```

## Using the Metadata Consumer

### Basic Usage

To start consuming user metadata events, you can use the example consumer:

```typescript
import { startUserMetadataConsumer } from './lib/kafka-consumer-metadata';

// Start the consumer
await startUserMetadataConsumer();
```

### Customizing the Consumer

The consumer example includes placeholder functions for common use cases:

1. **Store in Database**
   ```typescript
   async function storeUserMetadataInDatabase(event: UserMetadataEvent) {
     // Implement your database logic
   }
   ```

2. **Send to Analytics Platform**
   ```typescript
   async function sendToAnalytics(event: UserMetadataEvent) {
     // Send to Google Analytics, Mixpanel, etc.
   }
   ```

3. **Detect Suspicious Activity**
   ```typescript
   async function detectSuspiciousActivity(event: UserMetadataEvent) {
     // Implement fraud detection, bot detection, etc.
   }
   ```

## Example Use Cases

### 1. User Analytics
Track which browsers, devices, and operating systems your users are using to optimize your application.

### 2. Security Monitoring
Detect suspicious patterns like:
- Multiple connections from different IPs
- Bot-like behavior
- Unusual user agents

### 3. Personalization
Use device and browser information to:
- Provide optimized experiences
- Show device-specific content
- Adjust UI based on screen size

### 4. Compliance & Auditing
Maintain audit logs of user connections for compliance requirements.

## Data Structure

### UserMetadataEvent

```typescript
interface UserMetadataEvent {
  id: string;                    // Unique event ID
  userId: string;                // User's ID
  username: string;              // Username
  sessionId: string;             // Session ID
  timestamp: number;             // Event timestamp
  metadata: UserMeta;            // User metadata
  connectionInfo: {
    clientId: string;            // WebSocket client ID
    ipAddress?: string;          // IP address
    connectionTime: number;      // Connection timestamp
  };
}
```

### UserMeta

```typescript
interface UserMeta {
  ip?: string;                   // IP address
  userAgent?: string;            // Full user agent string
  browser?: string;              // Browser name and version
  os?: string;                   // Operating system
  device?: string;               // Device type (Desktop/Mobile/Tablet)
  language?: string;             // Language preferences
}
```

## Configuration

The user metadata topic is automatically created by Kafka with:
- **Partitions**: 3
- **Replication Factor**: 1

You can modify these in `src/lib/kafka.ts` if needed.

## Error Handling

- If Kafka publishing fails, the error is logged but doesn't prevent the user from joining
- The WebSocket connection continues normally even if metadata publishing fails
- This ensures resilience and doesn't impact the user experience

## Testing

To test the feature:

1. Start your Kafka and Redis services:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. Start the application:
   ```bash
   npm run dev
   ```

3. Connect users via WebSocket and check the logs for metadata events:
   ```
   📊 Published user metadata for John (user-123)
   ```

4. (Optional) Start the metadata consumer to see the events:
   ```typescript
   await startUserMetadataConsumer();
   ```

## Privacy Considerations

When collecting user metadata:
- Ensure compliance with GDPR, CCPA, and other privacy regulations
- Inform users about data collection in your privacy policy
- Consider anonymizing or hashing IP addresses
- Implement data retention policies
- Provide users with access to their data

## Next Steps

Consider implementing:
- Data persistence layer (MongoDB, PostgreSQL, etc.)
- Real-time analytics dashboard
- Anomaly detection system
- User behavior tracking
- A/B testing based on device/browser

