# Kafka Security Configuration Guide

This guide explains how to configure Stream Wars to connect to Kafka with various security configurations including SSL/TLS, MTLS, and SCRAM-SHA authentication.

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [SSL/TLS Configuration](#ssltls-configuration)
- [MTLS Configuration](#mtls-configuration)
- [SCRAM-SHA Authentication](#scram-sha-authentication)
- [Configuration Examples](#configuration-examples)
- [Certificate Management](#certificate-management)
- [Troubleshooting](#troubleshooting)

## Overview

Stream Wars supports multiple Kafka security configurations:

1. **No Security** - For local development only
2. **SSL/TLS** - Encrypted connections
3. **MTLS** - Mutual TLS with client certificates
4. **SASL/PLAIN** - Basic username/password authentication
5. **SASL/SCRAM-SHA-256** - Secure password authentication
6. **SASL/SCRAM-SHA-512** - Most secure password authentication

You can combine SSL/TLS (or MTLS) with any SASL mechanism for maximum security.

## Authentication Methods

### SASL Mechanisms

The application supports three SASL mechanisms via the `KAFKA_SASL_MECHANISM` environment variable:

#### 1. PLAIN
- Simple username/password authentication
- Should **always** be used with SSL/TLS
- Credentials are base64 encoded (not encrypted without SSL)
- Good for: Development, Confluent Cloud

```env
KAFKA_SASL_MECHANISM=plain
KAFKA_USERNAME=your-username
KAFKA_PASSWORD=your-password
```

#### 2. SCRAM-SHA-256
- Salted Challenge Response Authentication Mechanism
- More secure than PLAIN
- Password never sent over the wire
- Good for: Production environments

```env
KAFKA_SASL_MECHANISM=scram-sha-256
KAFKA_USERNAME=your-username
KAFKA_PASSWORD=your-password
```

#### 3. SCRAM-SHA-512
- Same as SCRAM-SHA-256 but with SHA-512 hashing
- Most secure SASL mechanism
- Recommended for: High-security production environments

```env
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_USERNAME=your-username
KAFKA_PASSWORD=your-password
```

## SSL/TLS Configuration

SSL/TLS encrypts the connection between your application and Kafka brokers.

### Basic SSL Setup

```env
# Enable SSL
KAFKA_SSL=true

# Kafka broker with SSL port (typically 9093)
KAFKA_BROKERS=kafka.example.com:9093

# Optional: CA certificate for custom/self-signed certs
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem

# Optional: Disable cert verification (dev only)
KAFKA_SSL_REJECT_UNAUTHORIZED=false
```

### When to Use CA Certificates

You need to provide a CA certificate when:
- Using self-signed certificates
- Using private/internal CA
- Corporate environments with custom CAs

You **don't** need a CA certificate when:
- Using publicly trusted CAs (Let's Encrypt, DigiCert, etc.)
- Connecting to cloud providers (AWS MSK, Confluent Cloud, etc.)

## MTLS Configuration

Mutual TLS (MTLS) requires both the client and server to authenticate using certificates.

### Setup Steps

1. **Obtain certificates from your Kafka administrator:**
   - CA certificate (`ca-cert.pem`)
   - Client certificate (`client-cert.pem`)
   - Client private key (`client-key.pem`)

2. **Place certificates in the `certs` directory:**
   ```bash
   mkdir -p certs
   cp /path/to/ca-cert.pem certs/
   cp /path/to/client-cert.pem certs/
   cp /path/to/client-key.pem certs/
   chmod 600 certs/client-key.pem  # Secure the private key
   ```

3. **Configure environment variables:**
   ```env
   # Enable SSL
   KAFKA_SSL=true
   
   # Kafka brokers
   KAFKA_BROKERS=kafka.example.com:9093
   
   # CA certificate
   KAFKA_SSL_CA_PATH=./certs/ca-cert.pem
   
   # Client certificates for MTLS
   KAFKA_SSL_CERT_PATH=./certs/client-cert.pem
   KAFKA_SSL_KEY_PATH=./certs/client-key.pem
   
   # If your private key is encrypted
   KAFKA_SSL_KEY_PASSPHRASE=your-passphrase
   ```

### MTLS with Docker

When using Docker, you have two options:

#### Option 1: Mount certificates as volumes

```yaml
services:
  app:
    volumes:
      - ./certs:/app/certs:ro
    environment:
      - KAFKA_SSL=true
      - KAFKA_SSL_CA_PATH=/app/certs/ca-cert.pem
      - KAFKA_SSL_CERT_PATH=/app/certs/client-cert.pem
      - KAFKA_SSL_KEY_PATH=/app/certs/client-key.pem
```

#### Option 2: Use inline certificates

```yaml
services:
  app:
    environment:
      - KAFKA_SSL=true
      - KAFKA_SSL_CA=${KAFKA_SSL_CA}
      - KAFKA_SSL_CERT=${KAFKA_SSL_CERT}
      - KAFKA_SSL_KEY=${KAFKA_SSL_KEY}
```

Then provide certificates as environment variables (use Docker secrets for production):

```bash
export KAFKA_SSL_CA=$(cat certs/ca-cert.pem)
export KAFKA_SSL_CERT=$(cat certs/client-cert.pem)
export KAFKA_SSL_KEY=$(cat certs/client-key.pem)
```

## SCRAM-SHA Authentication

SCRAM-SHA provides secure password authentication without sending passwords over the wire.

### Setting up SCRAM-SHA on Kafka

Your Kafka administrator needs to:

1. **Enable SCRAM in Kafka configuration:**
   ```properties
   # server.properties
   sasl.enabled.mechanisms=SCRAM-SHA-256,SCRAM-SHA-512
   ```

2. **Create user with SCRAM credentials:**
   ```bash
   # Create user with SCRAM-SHA-256
   kafka-configs --zookeeper localhost:2181 --alter \
     --add-config 'SCRAM-SHA-256=[iterations=8192,password=your-password]' \
     --entity-type users --entity-name stream-wars-user
   
   # Or with SCRAM-SHA-512
   kafka-configs --zookeeper localhost:2181 --alter \
     --add-config 'SCRAM-SHA-512=[iterations=4096,password=your-password]' \
     --entity-type users --entity-name stream-wars-user
   ```

### Connecting with SCRAM-SHA

```env
# Use SSL for encrypted connection
KAFKA_SSL=true
KAFKA_BROKERS=kafka.example.com:9093

# SCRAM-SHA-256 authentication
KAFKA_SASL_MECHANISM=scram-sha-256
KAFKA_USERNAME=stream-wars-user
KAFKA_PASSWORD=your-password

# Optional: Add CA cert if needed
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem
```

## Configuration Examples

### Example 1: Local Development (No Security)

```env
KAFKA_BROKERS=127.0.0.1:9092
KAFKA_SSL=false
```

### Example 2: SSL Only

```env
KAFKA_BROKERS=kafka.example.com:9093
KAFKA_SSL=true
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem
```

### Example 3: SSL + SCRAM-SHA-256

```env
KAFKA_BROKERS=kafka.example.com:9093
KAFKA_SSL=true
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem
KAFKA_SASL_MECHANISM=scram-sha-256
KAFKA_USERNAME=stream-wars-user
KAFKA_PASSWORD=your-secure-password
```

### Example 4: MTLS + SCRAM-SHA-512 (Maximum Security)

```env
KAFKA_BROKERS=kafka1.internal:9093,kafka2.internal:9093,kafka3.internal:9093
KAFKA_SSL=true
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem
KAFKA_SSL_CERT_PATH=./certs/client-cert.pem
KAFKA_SSL_KEY_PATH=./certs/client-key.pem
KAFKA_SSL_KEY_PASSPHRASE=your-key-passphrase
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_USERNAME=stream-wars-client
KAFKA_PASSWORD=your-secure-password
```

### Example 5: Confluent Cloud

```env
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_USERNAME=your-api-key
KAFKA_PASSWORD=your-api-secret
```

### Example 6: AWS MSK with IAM Auth

```env
# Note: AWS IAM auth requires additional setup and is not currently supported
# Use SCRAM-SHA for MSK instead:
KAFKA_BROKERS=b-1.msk-cluster.xxxxx.kafka.us-east-1.amazonaws.com:9096
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_USERNAME=your-msk-username
KAFKA_PASSWORD=your-msk-password
```

## Certificate Management

### Certificate File Formats

- **PEM Format** (most common): Text files with `-----BEGIN CERTIFICATE-----` headers
- **DER Format**: Binary format (not supported, convert to PEM)
- **PKCS#12/PFX**: Combined cert+key (not supported, extract to PEM)

### Converting Certificates

```bash
# Convert DER to PEM
openssl x509 -inform der -in cert.der -out cert.pem

# Extract from PKCS#12
openssl pkcs12 -in keystore.p12 -out cert.pem -clcerts -nokeys
openssl pkcs12 -in keystore.p12 -out key.pem -nocerts -nodes

# Convert Java KeyStore to PEM
keytool -exportcert -alias mycert -keystore keystore.jks -rfc -file cert.pem
```

### Security Best Practices

1. **Never commit certificates to git**
   - Add `certs/` to `.gitignore`
   - Use environment variables or secrets managers

2. **Secure private keys**
   ```bash
   chmod 600 certs/*.key
   chmod 600 certs/*-key.pem
   ```

3. **Use encrypted keys in production**
   - Generate keys with passphrase
   - Store passphrase in secrets manager
   - Set `KAFKA_SSL_KEY_PASSPHRASE`

4. **Rotate certificates regularly**
   - Set up monitoring for expiring certificates
   - Have a renewal process in place

5. **Use Docker secrets in production**
   ```yaml
   secrets:
     kafka_key:
       file: ./certs/client-key.pem
   
   services:
     app:
       secrets:
         - kafka_key
       environment:
         - KAFKA_SSL_KEY_PATH=/run/secrets/kafka_key
   ```

## Troubleshooting

### Common Issues

#### 1. Connection Refused

```
Error: Connection to broker failed
```

**Solutions:**
- Verify broker address and port
- Check if SSL port is 9093 (not 9092)
- Ensure firewall allows connections
- Verify Kafka is running and accessible

#### 2. SSL Handshake Failed

```
Error: SSL handshake failed
```

**Solutions:**
- Verify `KAFKA_SSL=true` is set
- Check CA certificate is correct
- For self-signed certs, set `KAFKA_SSL_REJECT_UNAUTHORIZED=false` (dev only)
- Verify certificate expiration dates

#### 3. Authentication Failed

```
Error: SASL SCRAM SHA256 authentication failed
```

**Solutions:**
- Verify username and password
- Check SASL mechanism matches Kafka configuration
- Ensure user exists in Kafka
- Verify ACLs allow access

#### 4. Certificate Errors

```
Error: unable to get local issuer certificate
```

**Solutions:**
- Provide CA certificate via `KAFKA_SSL_CA_PATH`
- Verify certificate chain is complete
- Check certificate format (must be PEM)

#### 5. Private Key Errors

```
Error: error:0906A068:PEM routines:PEM_do_header:bad password read
```

**Solutions:**
- Set `KAFKA_SSL_KEY_PASSPHRASE` for encrypted keys
- Verify key file is readable
- Check file permissions (chmod 600)
- Ensure key format is PEM

### Debug Mode

Enable detailed logging to troubleshoot issues:

```typescript
// Add to kafka.ts for debugging
const kafka = new Kafka({
  // ... other config
  logLevel: logLevel.DEBUG,
  logCreator: () => ({ namespace, level, label, log }) => {
    console.log(`[${namespace}] ${level} ${label}`, log);
  }
});
```

### Testing Connection

Use the test script to verify your configuration:

```bash
# Test Kafka connection
npm run test:kafka

# Check logs for connection details
docker-compose logs app | grep -i kafka
```

## Security Checklist

- [ ] SSL/TLS enabled for production
- [ ] Using SCRAM-SHA-256 or SCRAM-SHA-512 (not PLAIN)
- [ ] Certificates stored securely (not in git)
- [ ] Private keys have restricted permissions (600)
- [ ] Using encrypted private keys with passphrases
- [ ] Certificate expiration monitoring in place
- [ ] Secrets managed via Docker secrets or secrets manager
- [ ] ACLs configured on Kafka for least privilege
- [ ] Regular security audits scheduled
- [ ] Certificate rotation process documented

## Additional Resources

- [KafkaJS Documentation](https://kafka.js.org/docs/configuration)
- [Apache Kafka Security](https://kafka.apache.org/documentation/#security)
- [Confluent Security Tutorial](https://docs.confluent.io/platform/current/security/security_tutorial.html)
- [AWS MSK Security](https://docs.aws.amazon.com/msk/latest/developerguide/security.html)

