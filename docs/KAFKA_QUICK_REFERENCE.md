# Kafka Security Quick Reference

Quick reference guide for configuring Stream Wars with secure Kafka connections.

## Environment Variables Reference

### Basic Configuration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAFKA_BROKERS` | Yes | `127.0.0.1:9092` | Comma-separated list of broker addresses |
| `KAFKA_CLIENT_ID` | No | `stream-wars-app` | Client identifier |
| `KAFKA_TOPIC` | No | `game-taps` | Topic name for game events |

### SSL/TLS Configuration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAFKA_SSL` | No | `false` | Enable SSL/TLS (`true` or `false`) |
| `KAFKA_SSL_REJECT_UNAUTHORIZED` | No | `true` | Reject self-signed certificates |
| `KAFKA_SSL_CA_PATH` | No | - | Path to CA certificate file |
| `KAFKA_SSL_CA` | No | - | Inline CA certificate (PEM format) |

### MTLS Configuration (Mutual TLS)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAFKA_SSL_CERT_PATH` | No* | - | Path to client certificate file |
| `KAFKA_SSL_CERT` | No* | - | Inline client certificate (PEM format) |
| `KAFKA_SSL_KEY_PATH` | No* | - | Path to client private key file |
| `KAFKA_SSL_KEY` | No* | - | Inline client private key (PEM format) |
| `KAFKA_SSL_KEY_PASSPHRASE` | No | - | Passphrase for encrypted private key |

*Required for MTLS authentication. Use either file paths OR inline values, not both.

### SASL Authentication
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAFKA_SASL_MECHANISM` | No* | `plain` | Auth mechanism: `plain`, `scram-sha-256`, `scram-sha-512` |
| `KAFKA_USERNAME` | No* | - | Kafka username |
| `KAFKA_PASSWORD` | No* | - | Kafka password |

*Required if using SASL authentication.

### Timeouts
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAFKA_CONNECTION_TIMEOUT` | No | `10000` | Connection timeout in milliseconds |
| `KAFKA_REQUEST_TIMEOUT` | No | `30000` | Request timeout in milliseconds |

## Configuration Matrix

### Security Combinations

| Use Case | SSL | MTLS | SASL | Recommended |
|----------|-----|------|------|-------------|
| Local Development | ❌ | ❌ | ❌ | ✅ |
| Cloud (Confluent, AWS MSK) | ✅ | ❌ | ✅ | ✅ |
| On-Premises (Basic) | ✅ | ❌ | ✅ | ⚠️ |
| On-Premises (Secure) | ✅ | ✅ | ✅ | ✅ |
| High Security | ✅ | ✅ | ✅ (SCRAM-SHA-512) | ✅ |

### Security Level Guide

#### Level 0: No Security (Development Only)
```env
KAFKA_BROKERS=127.0.0.1:9092
KAFKA_SSL=false
```
⚠️ **Use only for local development**

#### Level 1: SSL Only
```env
KAFKA_BROKERS=kafka.example.com:9093
KAFKA_SSL=true
```
✅ Good for trusted cloud providers with built-in CA

#### Level 2: SSL + SASL/PLAIN
```env
KAFKA_BROKERS=kafka.example.com:9093
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_USERNAME=your-username
KAFKA_PASSWORD=your-password
```
✅ Good for Confluent Cloud, basic cloud deployments

#### Level 3: SSL + SASL/SCRAM-SHA-256
```env
KAFKA_BROKERS=kafka.example.com:9093
KAFKA_SSL=true
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem
KAFKA_SASL_MECHANISM=scram-sha-256
KAFKA_USERNAME=your-username
KAFKA_PASSWORD=your-password
```
✅ Recommended for production

#### Level 4: MTLS + SASL/SCRAM-SHA-512
```env
KAFKA_BROKERS=kafka1.internal:9093,kafka2.internal:9093
KAFKA_SSL=true
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem
KAFKA_SSL_CERT_PATH=./certs/client-cert.pem
KAFKA_SSL_KEY_PATH=./certs/client-key.pem
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_USERNAME=your-username
KAFKA_PASSWORD=your-password
```
✅ Maximum security for high-compliance environments

## Cloud Provider Configurations

### Confluent Cloud
```env
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_USERNAME=<API_KEY>
KAFKA_PASSWORD=<API_SECRET>
```

### AWS MSK (SCRAM-SHA-512)
```env
KAFKA_BROKERS=b-1.msk-cluster.kafka.us-east-1.amazonaws.com:9096
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_USERNAME=<MSK_USERNAME>
KAFKA_PASSWORD=<MSK_PASSWORD>
```

### Azure Event Hubs (Kafka-compatible)
```env
KAFKA_BROKERS=<namespace>.servicebus.windows.net:9093
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_USERNAME=$ConnectionString
KAFKA_PASSWORD=Endpoint=sb://<namespace>.servicebus.windows.net/;...
```

## Docker Configuration

### Development (docker-compose.dev.yml)
```yaml
services:
  app:
    environment:
      - KAFKA_SSL=false
      - KAFKA_BROKERS=kafka:9092
```

### Production with MTLS
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
      - KAFKA_SASL_MECHANISM=scram-sha-512
      - KAFKA_USERNAME=${KAFKA_USERNAME}
      - KAFKA_PASSWORD=${KAFKA_PASSWORD}
```

### Using Docker Secrets (Production)
```yaml
secrets:
  kafka_cert:
    file: ./certs/client-cert.pem
  kafka_key:
    file: ./certs/client-key.pem

services:
  app:
    secrets:
      - kafka_cert
      - kafka_key
    environment:
      - KAFKA_SSL_CERT_PATH=/run/secrets/kafka_cert
      - KAFKA_SSL_KEY_PATH=/run/secrets/kafka_key
```

## Certificate File Structure

```
stream-wars/
├── certs/                      # Certificate directory (gitignored)
│   ├── ca-cert.pem            # CA certificate
│   ├── client-cert.pem        # Client certificate (MTLS)
│   ├── client-key.pem         # Client private key (MTLS)
│   └── README.md              # Certificate guide
├── env.example                 # Environment template
└── .env.local                  # Your local config (gitignored)
```

## Troubleshooting Commands

### Test Kafka Connection
```bash
# Test basic connectivity
npm run test:kafka

# Check logs
docker-compose logs app | grep -i kafka

# Test with openssl (SSL/TLS)
openssl s_client -connect kafka.example.com:9093
```

### Verify Certificates
```bash
# Check certificate expiration
openssl x509 -in certs/client-cert.pem -noout -dates

# Verify certificate chain
openssl verify -CAfile certs/ca-cert.pem certs/client-cert.pem

# Check certificate details
openssl x509 -in certs/client-cert.pem -text -noout
```

### Debug Connection Issues
```bash
# Enable debug logging in kafka.ts
logLevel: logLevel.DEBUG

# Check broker connectivity
telnet kafka.example.com 9093

# Verify DNS resolution
nslookup kafka.example.com
```

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Connection refused` | Wrong port or broker address | Verify `KAFKA_BROKERS` and port |
| `SSL handshake failed` | SSL config mismatch | Check `KAFKA_SSL=true` and CA cert |
| `SASL authentication failed` | Wrong credentials | Verify username/password |
| `unable to get local issuer certificate` | Missing CA cert | Provide `KAFKA_SSL_CA_PATH` |
| `bad password read` | Wrong key passphrase | Check `KAFKA_SSL_KEY_PASSPHRASE` |

## Security Checklist

Before deploying to production:

- [ ] SSL/TLS enabled (`KAFKA_SSL=true`)
- [ ] Using SCRAM-SHA-256 or SCRAM-SHA-512 (not PLAIN)
- [ ] Certificates not in git repository
- [ ] Private keys have restricted permissions (chmod 600)
- [ ] Using environment variables or secrets manager for credentials
- [ ] Certificate expiration monitoring configured
- [ ] Using Docker secrets in production
- [ ] ACLs configured on Kafka brokers
- [ ] Network security groups/firewalls configured
- [ ] Regular security audits scheduled

## Additional Resources

- 📚 [Complete Security Guide](./KAFKA_SECURITY.md)
- 📂 [Certificate Setup Guide](../certs/README.md)
- 📝 [Environment Variables Template](../env.example)
- 🔧 [Docker Setup Guide](./DOCKER_GUIDE.md)

