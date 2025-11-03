import { initializeKafka } from './src/lib/kafka';
import { startKafkaConsumer } from './src/lib/kafka-consumer';
import { standaloneWebSocketServer } from './src/lib/websocket-server';

const port = parseInt(process.env.WS_PORT || '3001', 10);

async function startServer() {
  try {
    console.log('Starting standalone WebSocket server...');
    await standaloneWebSocketServer.start(port);
    
    console.log('Initializing Kafka...');
    await initializeKafka();
    
    console.log('Starting Kafka consumer...');
    await startKafkaConsumer();
    
    console.log('All services started successfully');
  } catch (error) {
    console.error('Failed to start services:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  standaloneWebSocketServer.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  standaloneWebSocketServer.stop();
  process.exit(0);
});
