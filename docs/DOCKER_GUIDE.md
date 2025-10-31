# Docker Setup Guide

This project has **two Docker configurations** optimized for different use cases:

## 🔧 Development Mode (Recommended for Local Development)

**File**: `docker-compose.dev.yml`

### Features:
- ✅ **No build step** - starts instantly
- ✅ **Hot reload** - changes reflect immediately
- ✅ **Volume mounting** - edit code on your host machine
- ✅ **Fast iterations** - perfect for development
- ✅ **Full debugging** - all dev tools available

### Usage:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Or run in detached mode
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop
docker-compose -f docker-compose.dev.yml down
```

### What it does:
1. Mounts your local code into the container
2. Runs `npm install` automatically
3. Starts `npm run dev` (both Next.js and WebSocket server)
4. Changes to your code are reflected immediately
5. Kafka and Redis are available at localhost:9092 and localhost:6379

### Access:
- **App**: http://localhost:3000
- **WebSocket**: ws://localhost:3001
- **Leaderboard**: http://localhost:3000/leaderboard

---

## 🚀 Production Mode (Optimized for Deployment)

**File**: `docker-compose.yml` or `docker-compose.prod.yml`

### Features:
- ⚡ **50-60% smaller images** (400-600MB vs 1.2GB)
- ⚡ **30-40% faster builds**
- ⚡ **50-60% faster startup**
- 🔒 **Enhanced security** (non-root, minimal deps)
- 📦 **Compiled code** (no TypeScript overhead)
- 🏥 **Health checks** for reliability

### Usage:

```bash
# Build and start production environment
docker-compose up --build

# Or use the production config explicitly
docker-compose -f docker-compose.prod.yml up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

### What it does:
1. Builds Next.js in production mode
2. Compiles TypeScript to JavaScript
3. Creates optimized Docker image
4. Runs compiled code with Node.js (no tsx)
5. Includes health checks and monitoring

### Measure improvements:
```bash
./measure-optimization.sh
```

---

## 📊 Comparison

| Feature | Development Mode | Production Mode |
|---------|------------------|-----------------|
| **File** | `docker-compose.dev.yml` | `docker-compose.yml` |
| **Build Time** | ~30s (npm install) | ~3-5 min (full build) |
| **Startup Time** | ~10-15s | ~2-4s |
| **Image Size** | N/A (uses base node) | 400-600MB |
| **Hot Reload** | ✅ Yes | ❌ No |
| **Debug Tools** | ✅ Yes | ❌ No |
| **Performance** | Development | Optimized |
| **Use Case** | Local development | Production deployment |

---

## 🎯 Quick Start Guide

### First Time Setup:

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd stream-wars
   ```

2. **Start development environment**
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

3. **Access the app**
   - Open http://localhost:3000
   - Start tapping! 🎮

### Daily Development Workflow:

```bash
# Morning: Start your dev environment
docker-compose -f docker-compose.dev.yml up -d

# Work on your code (changes auto-reload)
# ... edit files ...

# Check logs if needed
docker-compose -f docker-compose.dev.yml logs -f app

# Evening: Stop when done
docker-compose -f docker-compose.dev.yml down
```

### Before Deployment:

```bash
# Test production build locally
docker-compose build
docker-compose up

# If everything works, deploy!
```

---

## 🔍 Troubleshooting

### Development Mode Issues:

**Issue**: "Cannot find module"
```bash
# Rebuild node_modules in container
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up
```

**Issue**: Port already in use
```bash
# Check what's using the port
lsof -i :3000
lsof -i :3001

# Kill the process or change ports in docker-compose.dev.yml
```

**Issue**: Changes not reflecting
```bash
# Restart the container
docker-compose -f docker-compose.dev.yml restart app
```

### Production Mode Issues:

**Issue**: Build fails
```bash
# Clean build
docker-compose down
docker system prune -f
docker-compose build --no-cache
```

**Issue**: "Cannot find module 'next/dist/compiled/webpack/webpack-lib'"
- This is expected during development. Use dev mode instead!
- For production, the standalone build handles this correctly

---

## 🛠️ Advanced Usage

### Development with Live Kafka Monitoring:

Add Kafka UI to `docker-compose.dev.yml`:
```yaml
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    ports:
      - "8080:8080"
    environment:
      - KAFKA_CLUSTERS_0_NAME=local
      - KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092
```

### Custom Environment Variables:

Create `.env` file:
```env
# Kafka
KAFKA_BROKERS=kafka:9092

# WebSocket
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Application
NODE_ENV=development
```

Then use:
```bash
docker-compose -f docker-compose.dev.yml --env-file .env up
```

### Using BuildKit for Faster Production Builds:

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Or use the advanced Dockerfile
# Uncomment line 6 in docker-compose.yml
docker-compose build
```

---

## 📚 Additional Resources

- **Optimization Details**: See [DOCKER_OPTIMIZATION.md](./DOCKER_OPTIMIZATION.md)
- **Main README**: See [README.md](./README.md)
- **Production Setup**: See [DOCKER_SETUP.md](./DOCKER_SETUP.md)

---

## 💡 Best Practices

### For Development:
- ✅ Always use `docker-compose.dev.yml`
- ✅ Keep containers running during work
- ✅ Use `docker-compose logs` to debug
- ✅ Commit your changes regularly

### For Production:
- ✅ Always use `docker-compose.yml` (production config)
- ✅ Test the production build before deploying
- ✅ Monitor health checks in production
- ✅ Use environment variables for configuration
- ✅ Run security scans before deployment

### For Both:
- ✅ Keep Docker and Docker Compose updated
- ✅ Use `.dockerignore` to exclude unnecessary files
- ✅ Clean up unused images regularly: `docker system prune -a`

---

## 🎉 Summary

- **Local Development**: Use `docker-compose.dev.yml` for fast iterations
- **Production**: Use `docker-compose.yml` for optimized deployment
- **Testing**: Test production builds locally before deploying

Happy coding! 🚀

