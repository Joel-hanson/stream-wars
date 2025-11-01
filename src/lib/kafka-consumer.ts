import { getConsumer, TOPICS } from './kafka';
import { incrementUserTaps } from './redis';
import { TapEvent } from './types';
import { standaloneWebSocketServer } from './websocket-server';

export async function startKafkaConsumer() {
  try {
    // Get consumer at runtime, not at module load time
    const consumer = await getConsumer();
    
    await consumer.subscribe({ topic: TOPICS.GAME_TAPS, fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          if (topic === TOPICS.GAME_TAPS && message.value) {
            const tapEvent: TapEvent = JSON.parse(message.value.toString());
            
            // Process tap event
            await processTapEvent(tapEvent);
          }
        } catch (error) {
          console.error('Error processing Kafka message:', error);
        }
      },
    });
    
    console.log('Kafka consumer started successfully');
  } catch (error) {
    console.error('Failed to start Kafka consumer:', error);
    throw error;
  }
}

/**
 * Process a tap event by updating Redis state and broadcasting via WebSocket
 */
async function processTapEvent(tapEvent: TapEvent): Promise<void> {
  try {
    // Increment user taps in Redis
    const updatedUser = await incrementUserTaps(tapEvent.userId);
    
    if (updatedUser) {
      // Broadcast the update to all connected WebSocket clients
      await standaloneWebSocketServer.broadcastGameUpdate(updatedUser);
      
      console.log(`Processed tap from ${tapEvent.username} (${tapEvent.team}) - Total: ${updatedUser.tapCount}`);
    } else {
      console.log(`User ${tapEvent.userId} not found in Redis`);
    }
  } catch (error) {
    console.error('Error processing tap event:', error);
  }
}
