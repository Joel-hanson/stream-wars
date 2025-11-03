import { getConsumer, TOPICS } from './kafka';
import { UserMetadataEvent } from './types';

/**
 * Example consumer for user metadata events
 * This can be used to process user metadata, store it in a database,
 * perform analytics, or send to other systems
 */
export async function startUserMetadataConsumer() {
  try {
    // Get consumer at runtime, not at module load time
    const consumer = await getConsumer();
    
    await consumer.subscribe({ topic: TOPICS.USER_METADATA, fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          if (topic === TOPICS.USER_METADATA && message.value) {
            const metadataEvent: UserMetadataEvent = JSON.parse(message.value.toString());
            
            // Process user metadata event
            await processUserMetadata(metadataEvent);
          }
        } catch (error) {
          console.error('Error processing user metadata message:', error);
        }
      },
    });
    
    console.log('User metadata consumer started successfully');
  } catch (error) {
    console.error('Failed to start user metadata consumer:', error);
    throw error;
  }
}

/**
 * Process a user metadata event
 * You can customize this function to:
 * - Store metadata in a database
 * - Send to analytics platforms
 * - Perform user profiling
 * - Detect bots or suspicious activity
 * - Generate reports
 */
async function processUserMetadata(metadataEvent: UserMetadataEvent): Promise<void> {
  try {
    console.log(`User Metadata Received:
      User ID: ${metadataEvent.userId}
      Username: ${metadataEvent.username}
      Session: ${metadataEvent.sessionId}
      IP: ${metadataEvent.connectionInfo.ipAddress}
      Browser: ${metadataEvent.metadata.browser || 'Unknown'}
      OS: ${metadataEvent.metadata.os || 'Unknown'}
      Device: ${metadataEvent.metadata.device || 'Unknown'}
      Language: ${metadataEvent.metadata.language || 'Unknown'}
      User Agent: ${metadataEvent.metadata.userAgent || 'Unknown'}
      Connected at: ${new Date(metadataEvent.connectionInfo.connectionTime).toISOString()}
    `);
    
    // Example: Store in database (implement your own logic)
    // await storeUserMetadataInDatabase(metadataEvent);
    
    // Example: Send to analytics platform (implement your own logic)
    // await sendToAnalytics(metadataEvent);
    
    // Example: Check for suspicious activity (implement your own logic)
    // await detectSuspiciousActivity(metadataEvent);
    
  } catch (error) {
    console.error('Error processing user metadata event:', error);
  }
}

/**
 * Example: Store user metadata in database
 * Implement this based on your database choice
 */
// async function storeUserMetadataInDatabase(event: UserMetadataEvent): Promise<void> {
//   // Your database logic here
//   // e.g., await db.userMetadata.create({ ... });
// }

/**
 * Example: Send to analytics platform
 */
// async function sendToAnalytics(event: UserMetadataEvent): Promise<void> {
//   // Your analytics logic here
//   // e.g., await analytics.track('user_connected', { ... });
// }

/**
 * Example: Detect suspicious activity
 */
// async function detectSuspiciousActivity(event: UserMetadataEvent): Promise<void> {
//   // Your security logic here
//   // e.g., check for unusual patterns, multiple connections, etc.
// }

