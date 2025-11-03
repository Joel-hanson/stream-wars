# Kafka Security Setup - Implementation Summary

This document summarizes the security enhancements made to the Stream Wars application to support secure Kafka connections.

## Overview

The application now supports comprehensive Kafka security configurations including:
- ✅ SSL/TLS encryption
- ✅ MTLS (Mutual TLS) authentication
- ✅ SASL/PLAIN authentication
- ✅ SASL/SCRAM-SHA-256 authentication
- ✅ SASL/SCRAM-SHA-512 authentication

## Files Modified

### Core Application Files

#### 1. `src/lib/kafka.ts`
**Changes:**
- Added SSL/TLS configuration function `getSSLConfig()`
- Added SASL configuration function `getSASLConfig()`
- Support for both file-based and inline certificates
- Support for encrypted private keys with passphrases
- Type-safe SSL configuration with `SSLConfig` interface
- Enhanced error handling for certificate loading

**New Features:**
- CA certificate support (file path or inline)
- Client certificates for MTLS (file path or inline)
- Private key passphrase support
- Multiple SASL mechanisms (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512)
- Configurable certificate validation
- Configurable connection/request timeouts

### Configuration Files

#### 2. `env.example` (NEW)
**Purpose:** Complete environment variable reference template

**Sections:**
- Basic Kafka configuration
- SSL/TLS settings
- Certificate configuration (file-based and inline)
- SASL authentication settings
- WebSocket configuration
- Redis configuration
- Example configurations for common scenarios

#### 3. `.gitignore`
**Changes:**
- Added exception for `env.example`
- Added specific patterns for certificate files
- Ensures certificates are never committed to git

#### 4. Docker Compose Files
**Files Updated:**
- `docker-compose.yml` - Production configuration
- `docker-compose.dev.yml` - Development configuration
- `docker-compose.prod.yml` - Production with Kafka UI

**Changes:**
- Added environment variables for Kafka security
- Added volume mounts for certificates
- Commented examples for easy configuration
- Support for file-based certificates

### Documentation

#### 5. `docs/KAFKA_SECURITY.md` (NEW)
**Content:**
- Complete security configuration guide
- Detailed explanation of authentication methods
- SSL/TLS setup instructions
- MTLS configuration guide
- SCRAM-SHA authentication setup
- Multiple configuration examples
- Certificate management best practices
- Troubleshooting guide
- Security checklist

#### 6. `docs/KAFKA_QUICK_REFERENCE.md` (NEW)
**Content:**
- Quick reference table for all environment variables
- Configuration matrix for different security levels
- Cloud provider specific configurations
- Common error messages and solutions
- Docker configuration examples
- Security checklist

#### 7. `docs/KAFKA_SECURITY_SETUP_SUMMARY.md` (NEW - This File)
**Content:**
- Summary of all changes
- Implementation details
- Usage instructions
- Next steps

#### 8. `README.md`
**Changes:**
- Added Kafka Security Configuration section
- Updated environment setup instructions
- Added links to detailed security documentation
- Added quick setup examples

### Certificate Management

#### 9. `certs/` Directory (NEW)
**Purpose:** Store Kafka SSL/TLS certificates

**Structure:**
```
certs/
├── README.md           # Certificate setup guide
├── ca-cert.pem        # CA certificate (gitignored)
├── client-cert.pem    # Client certificate (gitignored)
└── client-key.pem     # Client private key (gitignored)
```

#### 10. `certs/README.md` (NEW)
**Content:**
- Certificate setup instructions
- File format requirements
- Security best practices
- Verification commands
- Troubleshooting tips
- Docker integration guide

### Testing

#### 11. `scripts/test-kafka-connection.ts` (NEW)
**Purpose:** Comprehensive Kafka connection test script

**Features:**
- Tests connection with configured security settings
- Displays current configuration
- Tests admin, producer, and consumer connections
- Lists topics and cluster information
- Provides helpful error messages and hints
- Color-coded output for easy reading

#### 12. `package.json`
**Changes:**
- Added `test:kafka` script to run connection tests

## Environment Variables Added

### Basic Configuration
- `KAFKA_CONNECTION_TIMEOUT` - Connection timeout in milliseconds
- `KAFKA_REQUEST_TIMEOUT` - Request timeout in milliseconds

### SSL/TLS Configuration
- `KAFKA_SSL` - Enable SSL/TLS (true/false)
- `KAFKA_SSL_REJECT_UNAUTHORIZED` - Reject self-signed certificates

### Certificate Configuration (File-Based)
- `KAFKA_SSL_CA_PATH` - Path to CA certificate
- `KAFKA_SSL_CERT_PATH` - Path to client certificate
- `KAFKA_SSL_KEY_PATH` - Path to client private key
- `KAFKA_SSL_KEY_PASSPHRASE` - Passphrase for encrypted key

### Certificate Configuration (Inline)
- `KAFKA_SSL_CA` - Inline CA certificate (PEM format)
- `KAFKA_SSL_CERT` - Inline client certificate (PEM format)
- `KAFKA_SSL_KEY` - Inline client private key (PEM format)

### SASL Authentication
- `KAFKA_SASL_MECHANISM` - Authentication mechanism (plain, scram-sha-256, scram-sha-512)
- `KAFKA_USERNAME` - Kafka username
- `KAFKA_PASSWORD` - Kafka password

## Usage Examples

### 1. Local Development (No Security)

```bash
# .env.local
KAFKA_BROKERS=127.0.0.1:9092
KAFKA_SSL=false
```

```bash
npm run dev
```

### 2. Cloud Kafka with SCRAM-SHA-256

```bash
# .env.local
KAFKA_BROKERS=kafka.example.com:9093
KAFKA_SSL=true
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem
KAFKA_SASL_MECHANISM=scram-sha-256
KAFKA_USERNAME=your-username
KAFKA_PASSWORD=your-password
```

```bash
# Place CA certificate
cp /path/to/ca-cert.pem certs/

# Test connection
npm run test:kafka

# Start application
npm run dev
```

### 3. On-Premises with MTLS + SCRAM-SHA-512

```bash
# .env.local
KAFKA_BROKERS=kafka1.internal:9093,kafka2.internal:9093,kafka3.internal:9093
KAFKA_SSL=true
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem
KAFKA_SSL_CERT_PATH=./certs/client-cert.pem
KAFKA_SSL_KEY_PATH=./certs/client-key.pem
KAFKA_SSL_KEY_PASSPHRASE=your-passphrase
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_USERNAME=stream-wars-client
KAFKA_PASSWORD=your-secure-password
```

```bash
# Place certificates
cp /path/to/ca-cert.pem certs/
cp /path/to/client-cert.pem certs/
cp /path/to/client-key.pem certs/

# Secure private key
chmod 600 certs/client-key.pem

# Test connection
npm run test:kafka

# Start application
npm run dev
```

### 4. Docker Deployment with MTLS

```bash
# Place certificates in certs/ directory
cp /path/to/certificates/* certs/

# Update docker-compose.yml - uncomment certificate mount
volumes:
  - ./certs:/app/certs:ro

# Update environment variables
environment:
  - KAFKA_SSL=true
  - KAFKA_SSL_CA_PATH=/app/certs/ca-cert.pem
  - KAFKA_SSL_CERT_PATH=/app/certs/client-cert.pem
  - KAFKA_SSL_KEY_PATH=/app/certs/client-key.pem
  - KAFKA_SASL_MECHANISM=scram-sha-512
  - KAFKA_USERNAME=your-username
  - KAFKA_PASSWORD=your-password
```

```bash
# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs app | grep -i kafka
```

## Testing the Configuration

### Test Kafka Connection

```bash
# Set environment variables in .env.local
# Then run:
npm run test:kafka
```

The test script will:
1. Display your current configuration
2. Test admin client connection
3. List available topics
4. Display cluster information
5. Test producer connection
6. Test consumer connection
7. Provide helpful error messages if something fails

### Manual Testing

```bash
# Start the application
npm run dev

# In another terminal, check logs
# Look for:
# - "Kafka MTLS configured with client certificates" (if using MTLS)
# - "Configuring Kafka with SCRAM-SHA-XXX authentication" (if using SCRAM)
# - "Kafka initialized successfully"
```

## Security Best Practices

1. ✅ **Never commit certificates to git**
   - Already configured in `.gitignore`
   - Use environment variables or secrets manager

2. ✅ **Secure private keys**
   ```bash
   chmod 600 certs/*.key
   chmod 600 certs/*-key.pem
   ```

3. ✅ **Use strong authentication**
   - Prefer SCRAM-SHA-512 over SCRAM-SHA-256
   - Prefer SCRAM-SHA-256 over PLAIN
   - Always use SSL with PLAIN authentication

4. ✅ **Use encrypted keys**
   - Generate keys with passphrases
   - Store passphrases in secrets manager
   - Set `KAFKA_SSL_KEY_PASSPHRASE`

5. ✅ **Production deployment**
   - Use Docker secrets
   - Use environment-specific configurations
   - Enable certificate validation
   - Configure ACLs on Kafka brokers

6. ✅ **Monitor certificates**
   - Set up expiration alerts
   - Have a renewal process
   - Test before expiration

## Troubleshooting

### Connection Issues

```bash
# Test Kafka connectivity
npm run test:kafka

# Check logs
docker-compose logs app | grep -i kafka

# Verify certificates
openssl x509 -in certs/client-cert.pem -noout -dates
openssl verify -CAfile certs/ca-cert.pem certs/client-cert.pem
```

### Common Errors

| Error | Solution |
|-------|----------|
| Connection refused | Check `KAFKA_BROKERS` and ensure Kafka is running |
| SSL handshake failed | Verify `KAFKA_SSL=true` and CA certificate |
| Authentication failed | Check username, password, and SASL mechanism |
| Certificate error | Verify certificate paths and file permissions |

### Debug Mode

For detailed logging, check console output when starting the application:
- SSL/MTLS status
- SASL mechanism
- Connection attempts
- Certificate loading status

## Next Steps

1. **Configure your environment**
   - Copy `env.example` to `.env.local`
   - Fill in your Kafka connection details
   - Add certificates if using SSL/MTLS

2. **Test the connection**
   ```bash
   npm run test:kafka
   ```

3. **Start the application**
   ```bash
   npm run dev
   ```

4. **Deploy to production**
   - Use Docker secrets for credentials
   - Enable SSL/TLS
   - Use SCRAM-SHA-512 authentication
   - Configure monitoring

## Additional Resources

- 📚 [Complete Security Guide](./KAFKA_SECURITY.md) - Detailed configuration guide
- 📋 [Quick Reference](./KAFKA_QUICK_REFERENCE.md) - Environment variables and examples
- 📂 [Certificate Guide](../certs/README.md) - Certificate setup and management
- 📝 [Environment Template](../env.example) - Complete configuration template
- 🐳 [Docker Guide](./DOCKER_GUIDE.md) - Docker deployment guide

## Support

For issues or questions:
1. Check the troubleshooting section in [KAFKA_SECURITY.md](./KAFKA_SECURITY.md)
2. Run `npm run test:kafka` to diagnose connection issues
3. Check application logs for detailed error messages
4. Verify certificate validity and permissions

## Summary

The Stream Wars application is now fully configured to support secure Kafka connections with industry-standard authentication and encryption methods. The implementation includes:

- ✅ Comprehensive SSL/TLS support
- ✅ MTLS authentication
- ✅ Multiple SASL mechanisms (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512)
- ✅ Flexible certificate management (file-based and inline)
- ✅ Docker integration
- ✅ Extensive documentation
- ✅ Testing utilities
- ✅ Security best practices

The application is ready to connect to any Kafka cluster, from local development to production environments, with appropriate security configurations.

