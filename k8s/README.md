# Stream Wars - Kubernetes/OpenShift Deployment

Simple deployment guide for Stream Wars on Kubernetes or OpenShift with external Kafka (Strimzi/EventStreams) and Redis.

## Quick Deploy

```bash
# 1. Update ConfigMap with your Kafka brokers and Redis URL
vim k8s/configmap.yaml

# 2. Create secrets (replace with your values)
kubectl create namespace stream-wars
kubectl create secret generic stream-wars-secrets \
  --from-literal=KAFKA_USERNAME="your-kafka-username" \
  --from-literal=KAFKA_PASSWORD="your-kafka-password" \
  --from-literal=NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  --namespace=stream-wars

# 3. Apply manifests
kubectl apply -f k8s/

# 4. For OpenShift, create routes
oc apply -f k8s/openshift-route.yaml
```

## Configuration

### Update ConfigMap

Edit `k8s/configmap.yaml` and set:

- `NEXT_PUBLIC_WS_URL`: Your public domain with WebSocket
- `KAFKA_BROKERS`: Your Kafka bootstrap servers
- `REDIS_URL`: Your Redis service URL

Example:
```yaml
NEXT_PUBLIC_WS_URL: "wss://stream-wars.example.com/ws"
KAFKA_BROKERS: "my-kafka-bootstrap.kafka.svc:9092"
REDIS_URL: "redis://redis-service.namespace.svc:6379"
```

### Kafka Setup

#### Strimzi

First, create a KafkaUser:

```bash
# Apply the KafkaUser
kubectl apply -f k8s/strimzi-kafka-user.yaml

# Get credentials
kubectl get secret stream-wars-user -n kafka -o jsonpath='{.data.username}' | base64 -d
kubectl get secret stream-wars-user -n kafka -o jsonpath='{.data.password}' | base64 -d

# Get broker address
kubectl get kafka my-kafka-cluster -n kafka -o jsonpath='{.status.listeners}'
```

Then mount certificates:

```bash
kubectl create secret generic kafka-client-certs \
  --from-literal=ca.crt="$(kubectl get secret stream-wars-user -n kafka -o jsonpath='{.data.ca\.crt}' | base64 -d)" \
  --from-literal=user.crt="$(kubectl get secret stream-wars-user -n kafka -o jsonpath='{.data.user\.crt}' | base64 -d)" \
  --from-literal=user.key="$(kubectl get secret stream-wars-user -n kafka -o jsonpath='{.data.user\.key}' | base64 -d)" \
  --namespace=stream-wars
```

#### IBM EventStreams

```bash
# Create MessageHubUser
kubectl apply -f k8s/eventstreams-user.yaml

# Get credentials
kubectl get secret stream-wars-user -n eventstreams -o jsonpath='{.data.password}' | base64 -d

# Get broker address
kubectl get eventstreams my-eventstreams-cluster -n eventstreams -o jsonpath='{.status.kafkaListeners[0].bootstrapServers}'
```

### Redis with Password

If Redis requires authentication, update ConfigMap:

```yaml
REDIS_URL: "redis://:your-password@redis-service:6379"
```

## Deployment

```bash
# Apply all resources
kubectl apply -f k8s/

# Check status
kubectl get pods -n stream-wars

# View logs
kubectl logs -f deployment/stream-wars -n stream-wars
```

## Access

```bash
# Get ingress/route URL
kubectl get ingress -n stream-wars
# or
oc get route -n stream-wars

# Port forward for local testing
kubectl port-forward svc/stream-wars 3000:80 -n stream-wars
```

## Troubleshooting

**Pods not starting:**
```bash
kubectl describe pod -n stream-wars
kubectl logs pod-name -n stream-wars
```

**Kafka connection issues:**
```bash
# Test Kafka connectivity
kubectl run test -it --rm --image=bitnami/kafka:latest -- bash
# Inside pod: nc -zv your-kafka-broker 9092
```

**Redis connection issues:**
```bash
# Test Redis connectivity
kubectl run redis-client -it --rm --image=redis:7-alpine -- redis-cli -h your-redis-service ping
```

## Clean Up

```bash
kubectl delete namespace stream-wars
```
