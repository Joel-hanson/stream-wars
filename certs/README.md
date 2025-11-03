# Kafka SSL/TLS Certificates

This directory is for storing Kafka SSL/TLS certificates used for secure connections.

## ⚠️ Important Security Notice

**NEVER commit certificates or private keys to version control!**

This directory should contain:
- CA certificates
- Client certificates (for MTLS)
- Client private keys (for MTLS)

All files in this directory are ignored by git (via `.gitignore`).

## Required Files for MTLS

Place the following files in this directory:

```
certs/
├── ca-cert.pem           # CA certificate (required for SSL with custom CA)
├── client-cert.pem       # Client certificate (required for MTLS)
└── client-key.pem        # Client private key (required for MTLS)
```

## File Permissions

Ensure private keys have restricted permissions:

```bash
chmod 600 certs/client-key.pem
chmod 600 certs/*.key
```

## Configuration

Reference these files in your `.env` or `.env.local`:

```env
# SSL with CA certificate
KAFKA_SSL=true
KAFKA_SSL_CA_PATH=./certs/ca-cert.pem

# MTLS with client certificates
KAFKA_SSL_CERT_PATH=./certs/client-cert.pem
KAFKA_SSL_KEY_PATH=./certs/client-key.pem

# If your private key is encrypted
KAFKA_SSL_KEY_PASSPHRASE=your-passphrase
```

## Obtaining Certificates

### From Kafka Administrator

Contact your Kafka administrator to obtain:
1. The CA certificate
2. A client certificate signed by the CA
3. The corresponding private key

### Generate Self-Signed Certificates (Dev Only)

For local development, you can generate self-signed certificates:

```bash
# Generate CA
openssl req -new -x509 -keyout ca-key.pem -out ca-cert.pem -days 365 \
  -subj "/CN=kafka-ca" -nodes

# Generate client key
openssl genrsa -out client-key.pem 2048

# Generate client certificate signing request
openssl req -new -key client-key.pem -out client.csr \
  -subj "/CN=stream-wars-client"

# Sign client certificate with CA
openssl x509 -req -in client.csr -CA ca-cert.pem -CAkey ca-key.pem \
  -CAcreateserial -out client-cert.pem -days 365

# Clean up
rm client.csr ca-key.pem ca-cert.srl
```

⚠️ **Note:** Self-signed certificates should only be used for development. For production, always use certificates from a trusted CA.

## Certificate Formats

Certificates must be in PEM format (text files with `-----BEGIN CERTIFICATE-----` headers).

### Converting Other Formats

```bash
# DER to PEM
openssl x509 -inform der -in cert.der -out cert.pem

# PKCS#12 to PEM
openssl pkcs12 -in cert.p12 -out cert.pem -clcerts -nokeys
openssl pkcs12 -in cert.p12 -out key.pem -nocerts -nodes

# Java KeyStore to PEM
keytool -exportcert -alias myalias -keystore keystore.jks -rfc -file cert.pem
```

## Docker Usage

### Mount as Volume

```yaml
services:
  app:
    volumes:
      - ./certs:/app/certs:ro  # Read-only mount
    environment:
      - KAFKA_SSL_CA_PATH=/app/certs/ca-cert.pem
      - KAFKA_SSL_CERT_PATH=/app/certs/client-cert.pem
      - KAFKA_SSL_KEY_PATH=/app/certs/client-key.pem
```

### Use Docker Secrets (Production)

```yaml
secrets:
  kafka_ca:
    file: ./certs/ca-cert.pem
  kafka_cert:
    file: ./certs/client-cert.pem
  kafka_key:
    file: ./certs/client-key.pem

services:
  app:
    secrets:
      - kafka_ca
      - kafka_cert
      - kafka_key
    environment:
      - KAFKA_SSL_CA_PATH=/run/secrets/kafka_ca
      - KAFKA_SSL_CERT_PATH=/run/secrets/kafka_cert
      - KAFKA_SSL_KEY_PATH=/run/secrets/kafka_key
```

## Verification

To verify your certificates are valid:

```bash
# Check certificate details
openssl x509 -in certs/ca-cert.pem -text -noout
openssl x509 -in certs/client-cert.pem -text -noout

# Verify certificate chain
openssl verify -CAfile certs/ca-cert.pem certs/client-cert.pem

# Check certificate expiration
openssl x509 -in certs/client-cert.pem -noout -enddate

# Test private key
openssl rsa -in certs/client-key.pem -check
```

## Troubleshooting

### Permission Denied
```bash
chmod 600 certs/client-key.pem
```

### Certificate Expired
```bash
# Check expiration
openssl x509 -in certs/client-cert.pem -noout -dates

# Generate new certificate
```

### Wrong Format
```bash
# Verify it's PEM format (should show readable text)
cat certs/client-cert.pem

# Should start with:
# -----BEGIN CERTIFICATE-----
```

## Security Best Practices

1. ✅ Keep this directory out of version control
2. ✅ Use restrictive file permissions (600 for keys)
3. ✅ Encrypt private keys with passphrases in production
4. ✅ Rotate certificates before expiration
5. ✅ Use different certificates for different environments
6. ✅ Store production certificates in a secrets manager
7. ✅ Never share private keys via email or chat
8. ✅ Monitor certificate expiration dates

## Additional Resources

- [Kafka SSL Documentation](https://kafka.apache.org/documentation/#security_ssl)
- [OpenSSL Certificate Management](https://www.openssl.org/docs/man1.1.1/man1/openssl-x509.html)
- [Confluent SSL Setup](https://docs.confluent.io/platform/current/kafka/authentication_ssl.html)

