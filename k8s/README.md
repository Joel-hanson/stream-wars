# Stream Wars - Kubernetes/OpenShift Deployment

Deployment guide for Stream Wars on Kubernetes or OpenShift with Strimzi Kafka and Redis in the same namespace.

## Prerequisites

- Kubernetes or OpenShift cluster
- Strimzi Kafka Operator installed
- Kafka cluster deployed in the `stream-wars` namespace
- Redis deployed in the `stream-wars` namespace
- kubectl or oc CLI configured

## Quick Deploy

### 1. Build and Push Docker Images

The application uses separate containers for the Next.js app and WebSocket server. Build both images:

```bash
# Build the app image (Next.js)
docker build -f Dockerfile.app -t your-registry/stream-wars-app:latest .

# Build the websocket image
docker build -f Dockerfile.ws -t your-registry/stream-wars-ws:latest .

# Push to registry
docker push your-registry/stream-wars-app:latest
docker push your-registry/stream-wars-ws:latest
```

**Note**: For local development, the existing `Dockerfile` (which runs both services) is still used by `docker-compose.yml`.

### 2. Update Configuration

Edit `k8s/configmap.yaml` and update:

- **KAFKA_BROKERS**: Replace `my-kafka-cluster` with your Strimzi Kafka cluster name
  ```yaml
  KAFKA_BROKERS: "your-kafka-cluster-kafka-bootstrap.stream-wars.svc.cluster.local:9092"
  ```

- **REDIS_URL**: Replace `redis` with your Redis service name
  ```yaml
  REDIS_URL: "redis://your-redis-service.stream-wars.svc.cluster.local:6379"
  ```

- **NEXT_PUBLIC_WS_URL**: Set your public WebSocket URL (for ingress/route)
  ```yaml
  NEXT_PUBLIC_WS_URL: "wss://stream-wars.example.com/ws"
  ```

### 3. Update Deployment Images

Edit `k8s/deployment.yaml` and set your images for both containers:

```yaml
containers:
  - name: stream-wars-app
    image: your-registry/stream-wars-app:latest
  - name: stream-wars-ws
    image: your-registry/stream-wars-ws:latest
```

### 4. Create Kafka User

Create a KafkaUser for the application:

```bash
# Apply the KafkaUser (update cluster name in the file)
kubectl apply -f k8s/strimzi-kafka-user.yaml

# Wait for the user to be ready
kubectl wait --for=condition=Ready kafkauser/stream-wars-user -n stream-wars --timeout=300s
```

### 5. Get Kafka Credentials

Extract the Kafka username and password from the secret:

```bash
# Get username
KAFKA_USERNAME=$(kubectl get secret stream-wars-user -n stream-wars -o jsonpath='{.data.username}' | base64 -d)

# Get password
KAFKA_PASSWORD=$(kubectl get secret stream-wars-user -n stream-wars -o jsonpath='{.data.password}' | base64 -d)

echo "Username: $KAFKA_USERNAME"
echo "Password: $KAFKA_PASSWORD"
```

### 6. Create Kafka Certificates Secret

Create a secret with Kafka certificates:

```bash
kubectl create secret generic kafka-client-certs \
  --from-literal=ca.crt="$(kubectl get secret stream-wars-user -n stream-wars -o jsonpath='{.data.ca\.crt}' | base64 -d)" \
  --from-literal=user.crt="$(kubectl get secret stream-wars-user -n stream-wars -o jsonpath='{.data.user\.crt}' | base64 -d)" \
  --from-literal=user.key="$(kubectl get secret stream-wars-user -n stream-wars -o jsonpath='{.data.user\.key}' | base64 -d)" \
  --namespace=stream-wars
```

### 7. Create Application Secrets

Create the application secrets:

```bash
kubectl create secret generic stream-wars-secrets \
  --from-literal=KAFKA_USERNAME="$KAFKA_USERNAME" \
  --from-literal=KAFKA_PASSWORD="$KAFKA_PASSWORD" \
  --from-literal=REDIS_PASSWORD="2i0V172Jzw" \
  --from-literal=NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  --namespace=stream-wars
```

### 8. Deploy Application

Apply all Kubernetes manifests:

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Apply ConfigMap
kubectl apply -f k8s/configmap.yaml

# Apply Services (app and websocket)
kubectl apply -f k8s/service-app.yaml
kubectl apply -f k8s/service-ws.yaml

# Apply Deployment (contains both app and websocket containers)
kubectl apply -f k8s/deployment.yaml

# For Kubernetes, apply Ingress
kubectl apply -f k8s/ingress.yaml

# For OpenShift, apply Routes
oc apply -f k8s/openshift-route.yaml
```

## Verify Deployment

```bash
# Check pods (each pod contains both app and websocket containers)
kubectl get pods -n stream-wars

# Check services
kubectl get svc -n stream-wars

# View logs for app container
kubectl logs -f deployment/stream-wars -n stream-wars -c stream-wars-app

# View logs for websocket container
kubectl logs -f deployment/stream-wars -n stream-wars -c stream-wars-ws

# View logs for both containers
kubectl logs -f deployment/stream-wars -n stream-wars --all-containers=true

# Check pod status
kubectl describe pod -n stream-wars -l app=stream-wars
```

## Access the Application

### Kubernetes (Ingress)

```bash
# Get ingress URL
kubectl get ingress -n stream-wars

# Or port-forward for testing
kubectl port-forward svc/stream-wars-app 3000:80 -n stream-wars
# In another terminal for websocket:
kubectl port-forward svc/stream-wars-ws 3001:3001 -n stream-wars
```

### OpenShift (Routes)

```bash
# Get route URLs
oc get routes -n stream-wars

# Access the application
oc get route stream-wars-app -n stream-wars -o jsonpath='{.spec.host}'
```

## Architecture

The deployment uses a single pod with two containers:

- **stream-wars-app**: Next.js application server (port 3000)
  - Handles HTTP requests and API routes
  - Uses Kafka producer for publishing events
  - Connects to Redis for state management

- **stream-wars-ws**: WebSocket server (port 3001)
  - Handles WebSocket connections
  - Uses Kafka consumer for processing events
  - Connects to Redis for state management
  - Broadcasts game updates to connected clients

Both containers share:
- The same pod (same network namespace)
- Environment variables from ConfigMap and Secrets
- Volume mounts for Kafka certificates
- Access to the same Redis and Kafka instances

## Configuration Details

### Kafka Configuration

The application expects:
- **Kafka Cluster**: Deployed via Strimzi in `stream-wars` namespace
- **KafkaUser**: Created with SCRAM-SHA-512 authentication
- **Topics**: `game-taps`, `game-updates`, `user-metadata` (auto-created if enabled)
- **Consumer Group**: `stream-wars-consumer`

### Redis Configuration

The application expects:
- **Redis Service**: Deployed in `stream-wars` namespace
- **Service Name**: `redis` (or update ConfigMap)
- **Port**: `6379`
- **Password**: Optional (add to REDIS_URL if needed)

### Environment Variables

Key environment variables (configured in ConfigMap):

- `KAFKA_BROKERS`: Kafka bootstrap servers
- `REDIS_URL`: Redis connection URL
- `NEXT_PUBLIC_WS_URL`: Public WebSocket URL for clients
- `KAFKA_SSL`: `true` (for Strimzi)
- `KAFKA_SASL_MECHANISM`: `scram-sha-512`

## Troubleshooting

### Pods Not Starting

```bash
# Check pod events
kubectl describe pod -n stream-wars -l app=stream-wars

# Check logs for app container
kubectl logs -n stream-wars -l app=stream-wars -c stream-wars-app --tail=100

# Check logs for websocket container
kubectl logs -n stream-wars -l app=stream-wars -c stream-wars-ws --tail=100

# Check logs for both containers
kubectl logs -n stream-wars -l app=stream-wars --all-containers=true --tail=100
```

### Kafka Connection Issues

```bash
# Verify Kafka cluster is running
kubectl get kafka -n stream-wars

# Check KafkaUser status
kubectl get kafkauser -n stream-wars

# Test Kafka connectivity from a pod
kubectl run kafka-test -it --rm --image=bitnami/kafka:latest -- bash
# Inside pod: nc -zv your-kafka-cluster-kafka-bootstrap.stream-wars.svc.cluster.local 9092
```

### Redis Connection Issues

```bash
# Verify Redis is running
kubectl get pods -n stream-wars | grep redis

# Test Redis connectivity
kubectl run redis-test -it --rm --image=redis:7-alpine -- \
  redis-cli -h redis.stream-wars.svc.cluster.local ping
```

### Certificate Issues

```bash
# Verify certificates secret exists
kubectl get secret kafka-client-certs -n stream-wars

# Check certificate paths in pod
kubectl exec -n stream-wars -l app=stream-wars -- ls -la /etc/kafka-client
```

## Updating Configuration

After updating ConfigMap:

```bash
# Apply changes
kubectl apply -f k8s/configmap.yaml

# Restart pods to pick up changes
kubectl rollout restart deployment/stream-wars -n stream-wars
```

## Scaling

```bash
# Scale deployment
kubectl scale deployment stream-wars --replicas=3 -n stream-wars

# Check scaling status
kubectl get deployment stream-wars -n stream-wars
```

## Clean Up

```bash
# Delete all resources
kubectl delete -f k8s/

# Or delete namespace (removes everything)
kubectl delete namespace stream-wars
```

## Example Strimzi Kafka Cluster

If you need to create a Kafka cluster, here's a minimal example:

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: my-kafka-cluster
  namespace: stream-wars
spec:
  kafka:
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
      - name: tls
        port: 9093
        type: internal
        tls: true
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
  zookeeper:
    replicas: 3
  entityOperator:
    topicOperator: {}
    userOperator: {}
```

## Example Redis Deployment

If you need to deploy Redis:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: stream-wars
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: stream-wars
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```
