import { Consumer, Kafka, Producer } from 'kafkajs';

// Get Kafka brokers from environment or use default
const getBrokers = () => {
  const brokers = process.env.KAFKA_BROKERS || '127.0.0.1:9092';
  const brokerList = brokers.split(',').map(b => b.trim());
  return brokerList;
};

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'stream-wars-app',
  brokers: getBrokers(),
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 300,
    retries: 8,
    maxRetryTime: 30000,
    multiplier: 2,
  },
  ssl: process.env.KAFKA_SSL === 'true',
  sasl: process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD ? {
    mechanism: 'plain',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  } : undefined,
});

export const TOPICS = {
  GAME_TAPS: process.env.KAFKA_TOPIC || 'game-taps',
  GAME_UPDATES: 'game-updates',
  USER_METADATA: 'user-metadata',
} as const;

let producer: Producer | null = null;
let consumer: Consumer | null = null;
let isInitialized = false;

export async function getProducer(): Promise<Producer> {
  if (!producer || !isInitialized) {
    throw new Error('Kafka not initialized. Call initializeKafka() first.');
  }
  return producer;
}

export async function getConsumer(): Promise<Consumer> {
  if (!consumer || !isInitialized) {
    throw new Error('Kafka not initialized. Call initializeKafka() first.');
  }
  return consumer;
}

export async function initializeKafka() {
  if (isInitialized) {
    console.log('Kafka already initialized');
    return;
  }

  try {
    console.log('Initializing Kafka...');
    
    // Create producer and consumer
    producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
    
    consumer = kafka.consumer({ 
      groupId: 'stream-wars-consumer',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    // Connect producer
    await producer.connect();
    console.log('Kafka producer connected');

    // Connect consumer
    await consumer.connect();
    console.log('Kafka consumer connected');
    
    // Create topics if they don't exist
    const admin = kafka.admin();
    await admin.connect();
    
    const existingTopics = await admin.listTopics();
    const topicsToCreate = Object.values(TOPICS).filter(
      topic => !existingTopics.includes(topic)
    );
    
    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate.map(topic => ({
          topic,
          numPartitions: 3,
          replicationFactor: 1,
        })),
      });
      console.log('Created topics:', topicsToCreate);
    }
    
    await admin.disconnect();
    
    isInitialized = true;
    console.log('Kafka initialized successfully');
    
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down Kafka connections...');
      try {
        if (producer) await producer.disconnect();
        if (consumer) await consumer.disconnect();
      } catch (error) {
        console.error('Error during Kafka shutdown:', error);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    console.error('Failed to initialize Kafka:', error);
    isInitialized = false;
    throw error;
  }
}

// Export for backward compatibility, but prefer getProducer()/getConsumer()
export { consumer, producer };
