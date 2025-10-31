import { initializeKafka } from './kafka';
import { startKafkaConsumer } from './kafka-consumer';
import { gameWebSocketServer } from './websocket';

let isInitialized = false;

export async function initializeServer() {
  if (isInitialized) return;
  
  try {
    // Initialize Kafka
    await initializeKafka();
    
    // Start Kafka consumer
    await startKafkaConsumer();
    
    isInitialized = true;
    console.log('Server initialized successfully');
  } catch (error) {
    console.error('Failed to initialize server:', error);
    throw error;
  }
}

export function getWebSocketServer() {
  return gameWebSocketServer;
}
