import { getConsumer, TOPICS } from './kafka';
import { addUser, balanceTeamAssignment, getUser, incrementUserTaps } from './redis';
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
    // Check if user exists in Redis
    let user = await getUser(tapEvent.userId);
    
    // If user doesn't exist, create them from the tap event
    if (!user) {
      // Use team from tap event if provided, otherwise balance teams
      const team = tapEvent.team || await balanceTeamAssignment();
      
      user = {
        id: tapEvent.userId,
        username: tapEvent.username,
        team: team,
        sessionId: tapEvent.sessionId,
        tapCount: 0,
        lastTapTime: Date.now(),
        meta: {},
      };
      
      // Add user to Redis
      await addUser(user);
      console.log(`Created user ${user.username} (${user.team}) from tap event`);
    }
    
    // Increment user taps in Redis (this also updates team scores and total taps)
    const updatedUser = await incrementUserTaps(tapEvent.userId);
    
    if (updatedUser) {
      // Broadcast the update to all connected WebSocket clients
      // This will send the updated game state (team scores, total taps) to all clients
      await standaloneWebSocketServer.broadcastGameUpdate(updatedUser);
      
      console.log(`Processed tap from ${tapEvent.username} (${updatedUser.team}) - User taps: ${updatedUser.tapCount}`);
    } else {
      console.error(`Failed to increment taps for user ${tapEvent.userId} after creating them`);
    }
  } catch (error) {
    console.error('Error processing tap event:', error);
  }
}
