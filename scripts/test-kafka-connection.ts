#!/usr/bin/env tsx

/**
 * Kafka Connection Test Script
 * 
 * Tests Kafka connectivity with the configured security settings.
 * This script will attempt to connect to Kafka using the environment
 * variables configured in .env.local or environment.
 * 
 * Usage:
 *   tsx scripts/test-kafka-connection.ts
 * 
 * Environment Variables:
 *   KAFKA_BROKERS - Comma-separated list of brokers
 *   KAFKA_SSL - Enable SSL (true/false)
 *   KAFKA_SASL_MECHANISM - SASL mechanism (plain, scram-sha-256, scram-sha-512)
 *   KAFKA_USERNAME - Username for SASL authentication
 *   KAFKA_PASSWORD - Password for SASL authentication
 *   KAFKA_SSL_CA_PATH - Path to CA certificate
 *   KAFKA_SSL_CERT_PATH - Path to client certificate (MTLS)
 *   KAFKA_SSL_KEY_PATH - Path to client key (MTLS)
 */

import { Kafka } from 'kafkajs';
import * as fs from 'fs';
import * as path from 'path';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logHeader(message: string) {
  console.log();
  log(`${'='.repeat(60)}`, colors.bright);
  log(message, colors.bright);
  log(`${'='.repeat(60)}`, colors.bright);
  console.log();
}

// Get configuration from environment
function getConfig() {
  const brokers = (process.env.KAFKA_BROKERS || '127.0.0.1:9092')
    .split(',')
    .map(b => b.trim());
  
  const ssl = process.env.KAFKA_SSL === 'true';
  const saslMechanism = process.env.KAFKA_SASL_MECHANISM?.toLowerCase();
  const username = process.env.KAFKA_USERNAME;
  const password = process.env.KAFKA_PASSWORD;

  // SSL configuration
  let sslConfig;
  if (ssl) {
    sslConfig = {
      rejectUnauthorized: process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== 'false',
    } as any;

    // CA certificate
    if (process.env.KAFKA_SSL_CA_PATH) {
      try {
        sslConfig.ca = [fs.readFileSync(path.resolve(process.env.KAFKA_SSL_CA_PATH), 'utf-8')];
      } catch (error) {
        logError(`Failed to read CA certificate from ${process.env.KAFKA_SSL_CA_PATH}`);
        throw error;
      }
    }

    // Client certificates (MTLS)
    if (process.env.KAFKA_SSL_CERT_PATH && process.env.KAFKA_SSL_KEY_PATH) {
      try {
        sslConfig.cert = fs.readFileSync(path.resolve(process.env.KAFKA_SSL_CERT_PATH), 'utf-8');
        sslConfig.key = fs.readFileSync(path.resolve(process.env.KAFKA_SSL_KEY_PATH), 'utf-8');
        
        if (process.env.KAFKA_SSL_KEY_PASSPHRASE) {
          sslConfig.passphrase = process.env.KAFKA_SSL_KEY_PASSPHRASE;
        }
      } catch (error) {
        logError(`Failed to read client certificates`);
        throw error;
      }
    }
  }

  // SASL configuration
  let saslConfig;
  if (username && password) {
    switch (saslMechanism) {
      case 'scram-sha-256':
        saslConfig = { mechanism: 'scram-sha-256' as const, username, password };
        break;
      case 'scram-sha-512':
        saslConfig = { mechanism: 'scram-sha-512' as const, username, password };
        break;
      case 'plain':
      default:
        saslConfig = { mechanism: 'plain' as const, username, password };
    }
  }

  return {
    brokers,
    ssl: sslConfig,
    sasl: saslConfig,
    clientId: process.env.KAFKA_CLIENT_ID || 'stream-wars-test',
  };
}

// Display current configuration
function displayConfig(config: any) {
  logHeader('Kafka Configuration');
  
  logInfo(`Client ID: ${config.clientId}`);
  logInfo(`Brokers: ${config.brokers.join(', ')}`);
  
  if (config.ssl) {
    logSuccess('SSL/TLS: Enabled');
    logInfo(`  - Reject Unauthorized: ${config.ssl.rejectUnauthorized !== false}`);
    if (config.ssl.ca) {
      logSuccess('  - CA Certificate: Loaded');
    }
    if (config.ssl.cert && config.ssl.key) {
      logSuccess('  - Client Certificates (MTLS): Loaded');
      if (config.ssl.passphrase) {
        logSuccess('  - Private Key: Encrypted with passphrase');
      }
    }
  } else {
    logWarning('SSL/TLS: Disabled');
  }
  
  if (config.sasl) {
    logSuccess(`SASL Authentication: Enabled (${config.sasl.mechanism.toUpperCase()})`);
    logInfo(`  - Username: ${config.sasl.username}`);
    logInfo(`  - Password: ${'*'.repeat(config.sasl.password.length)}`);
  } else {
    logWarning('SASL Authentication: Disabled');
  }
  
  console.log();
}

// Test Kafka connection
async function testConnection() {
  logHeader('Testing Kafka Connection');
  
  const config = getConfig();
  displayConfig(config);
  
  logInfo('Creating Kafka client...');
  const kafka = new Kafka({
    clientId: config.clientId,
    brokers: config.brokers,
    ssl: config.ssl,
    sasl: config.sasl,
    connectionTimeout: 10000,
    requestTimeout: 30000,
  });
  
  try {
    // Test with admin client
    logInfo('Connecting to Kafka admin...');
    const admin = kafka.admin();
    await admin.connect();
    logSuccess('Admin client connected successfully');
    
    // List topics
    logInfo('Listing topics...');
    const topics = await admin.listTopics();
    logSuccess(`Found ${topics.length} topics:`);
    topics.forEach(topic => {
      console.log(`  - ${topic}`);
    });
    
    // Get cluster info
    logInfo('Getting cluster info...');
    const cluster = await admin.describeCluster();
    logSuccess(`Cluster ID: ${cluster.clusterId || 'N/A'}`);
    logSuccess(`Controller: ${cluster.controller || 'N/A'}`);
    logSuccess(`Brokers: ${cluster.brokers.length}`);
    cluster.brokers.forEach(broker => {
      console.log(`  - Broker ${broker.nodeId}: ${broker.host}:${broker.port}`);
    });
    
    // Test producer
    logInfo('Testing producer...');
    const producer = kafka.producer();
    await producer.connect();
    logSuccess('Producer connected successfully');
    await producer.disconnect();
    logSuccess('Producer disconnected successfully');
    
    // Test consumer
    logInfo('Testing consumer...');
    const consumer = kafka.consumer({ groupId: 'test-group' });
    await consumer.connect();
    logSuccess('Consumer connected successfully');
    await consumer.disconnect();
    logSuccess('Consumer disconnected successfully');
    
    // Disconnect admin
    await admin.disconnect();
    logSuccess('Admin client disconnected successfully');
    
    logHeader('✅ All Tests Passed!');
    logSuccess('Kafka connection is working correctly with your security configuration.');
    
  } catch (error) {
    logHeader('❌ Connection Test Failed');
    logError('Failed to connect to Kafka');
    
    if (error instanceof Error) {
      logError(`Error: ${error.message}`);
      
      // Provide helpful hints based on error
      if (error.message.includes('ECONNREFUSED')) {
        logWarning('Hint: Check if Kafka is running and brokers are accessible');
      } else if (error.message.includes('SSL')) {
        logWarning('Hint: Check SSL/TLS configuration and certificates');
      } else if (error.message.includes('SASL')) {
        logWarning('Hint: Check SASL authentication credentials and mechanism');
      } else if (error.message.includes('timeout')) {
        logWarning('Hint: Check network connectivity and firewall rules');
      }
      
      console.log();
      logInfo('Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log();
  log('╔════════════════════════════════════════════════════════════╗', colors.bright);
  log('║           Stream Wars - Kafka Connection Test             ║', colors.bright);
  log('╚════════════════════════════════════════════════════════════╝', colors.bright);
  console.log();
  
  try {
    await testConnection();
  } catch (error) {
    logError('Unexpected error occurred');
    console.error(error);
    process.exit(1);
  }
}

main();

