import * as fs from 'fs';
import { Consumer, Kafka, Producer, SASLOptions } from 'kafkajs';
import * as path from 'path';

// SSL Configuration type
interface SSLConfig {
  rejectUnauthorized: boolean;
  ca?: string[];
  cert?: string;
  key?: string;
  passphrase?: string;
}

// Get Kafka brokers from environment or use default
const getBrokers = () => {
  const brokers = process.env.KAFKA_BROKERS || '127.0.0.1:9092';
  const brokerList = brokers.split(',').map(b => b.trim());
  return brokerList;
};

// Configure SSL/TLS
const getSSLConfig = (): SSLConfig | undefined => {
  // If SSL is not enabled, return undefined
  if (process.env.KAFKA_SSL !== 'true') {
    return undefined;
  }

  const sslConfig: SSLConfig = {
    rejectUnauthorized: process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== 'false',
  };

  // Add CA certificate if provided
  if (process.env.KAFKA_SSL_CA_PATH) {
    try {
      sslConfig.ca = [fs.readFileSync(path.resolve(process.env.KAFKA_SSL_CA_PATH), 'utf-8')];
    } catch (error) {
      console.error('Failed to read CA certificate:', error);
      throw new Error('Failed to load Kafka CA certificate');
    }
  } else if (process.env.KAFKA_SSL_CA) {
    // Support inline CA certificate
    sslConfig.ca = [process.env.KAFKA_SSL_CA];
  }

  // Add client certificate and key for MTLS (Mutual TLS)
  if (process.env.KAFKA_SSL_CERT_PATH && process.env.KAFKA_SSL_KEY_PATH) {
    try {
      sslConfig.cert = fs.readFileSync(path.resolve(process.env.KAFKA_SSL_CERT_PATH), 'utf-8');
      sslConfig.key = fs.readFileSync(path.resolve(process.env.KAFKA_SSL_KEY_PATH), 'utf-8');
      
      // Add passphrase if provided
      if (process.env.KAFKA_SSL_KEY_PASSPHRASE) {
        sslConfig.passphrase = process.env.KAFKA_SSL_KEY_PASSPHRASE;
      }
      
      console.log('Kafka MTLS configured with client certificates');
    } catch (error) {
      console.error('Failed to read client certificates:', error);
      throw new Error('Failed to load Kafka client certificates for MTLS');
    }
  } else if (process.env.KAFKA_SSL_CERT && process.env.KAFKA_SSL_KEY) {
    // Support inline certificates
    sslConfig.cert = process.env.KAFKA_SSL_CERT;
    sslConfig.key = process.env.KAFKA_SSL_KEY;
    
    if (process.env.KAFKA_SSL_KEY_PASSPHRASE) {
      sslConfig.passphrase = process.env.KAFKA_SSL_KEY_PASSPHRASE;
    }
    
    console.log('Kafka MTLS configured with inline client certificates');
  }

  return sslConfig;
};

// Configure SASL authentication
const getSASLConfig = (): SASLOptions | undefined => {
  const mechanism = process.env.KAFKA_SASL_MECHANISM?.toLowerCase();
  const username = process.env.KAFKA_USERNAME;
  const password = process.env.KAFKA_PASSWORD;

  if (!username || !password) {
    return undefined;
  }

  switch (mechanism) {
    case 'scram-sha-256':
      console.log('Configuring Kafka with SCRAM-SHA-256 authentication');
      return {
        mechanism: 'scram-sha-256',
        username,
        password,
      };
    
    case 'scram-sha-512':
      console.log('Configuring Kafka with SCRAM-SHA-512 authentication');
      return {
        mechanism: 'scram-sha-512',
        username,
        password,
      };
    
    case 'plain':
    default:
      console.log('Configuring Kafka with PLAIN authentication');
      return {
        mechanism: 'plain',
        username,
        password,
      };
  }
};

// Initialize Kafka client with enhanced security configuration
const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'stream-wars-app',
  brokers: getBrokers(),
  connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '10000', 10),
  requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000', 10),
  retry: {
    initialRetryTime: 300,
    retries: 8,
    maxRetryTime: 30000,
    multiplier: 2,
  },
  ssl: getSSLConfig(),
  sasl: getSASLConfig(),
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
