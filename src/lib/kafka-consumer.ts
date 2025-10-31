import { getConsumer, TOPICS } from './kafka';
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
            
            // Update user tap count in WebSocket server
            const users = standaloneWebSocketServer.getUsers();
            const user = users.find(u => u.id === tapEvent.userId);
            
            if (user) {
              user.tapCount += 1;
              user.lastTapTime = tapEvent.timestamp;
              standaloneWebSocketServer.updateUserTaps(tapEvent.userId, user.tapCount);
            } else {
              console.log(`User ${tapEvent.userId} not found in WebSocket server`);
            }
            
            console.log(`Processed tap from ${tapEvent.username} (${tapEvent.team}) - Total: ${user?.tapCount || 0}`);
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
