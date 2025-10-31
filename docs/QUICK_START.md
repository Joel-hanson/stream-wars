# 🚀 Quick Start - Stream Wars

## TL;DR - Get Started in 30 Seconds

```bash
# Clone and start
git clone <repo-url>
cd stream-wars
./dev.sh up

# Open browser
open http://localhost:3000
```

That's it! 🎮

---

## Two Simple Commands

### For Development (Hot Reload)
```bash
./dev.sh up
```
- Starts app with hot reload in ~30 seconds
- Edit code, see changes immediately
- Perfect for daily development

### For Production (Optimized)
```bash
./dev.sh prod
```
- Builds optimized Docker image
- 50-60% smaller and faster
- Use before deploying

---

## Helper Script Commands

```bash
./dev.sh up        # Start development environment
./dev.sh logs      # View application logs
./dev.sh down      # Stop everything
./dev.sh restart   # Restart services
./dev.sh clean     # Clean up Docker resources
./dev.sh prod      # Test production build
```

---

## Manual Commands (if you prefer)

### Development:
```bash
docker-compose -f docker-compose.dev.yml up
```

### Production:
```bash
docker-compose up --build
```

---

## Access Points

- **Game**: http://localhost:3000
- **Leaderboard**: http://localhost:3000/leaderboard
- **WebSocket**: ws://localhost:3001

---

## What's Running?

When you start with `./dev.sh up`, you get:
- ✅ Next.js app (port 3000)
- ✅ WebSocket server (port 3001)
- ✅ Apache Kafka (port 9092)
- ✅ Redis (port 6379)

Everything you need to develop! 🎉

---

## Troubleshooting

**Problem**: Port already in use
```bash
./dev.sh down      # Stop everything
./dev.sh up        # Start again
```

**Problem**: Changes not showing
```bash
./dev.sh restart   # Restart services
```

**Problem**: Something's broken
```bash
./dev.sh clean     # Clean everything
./dev.sh up        # Fresh start
```

---

## Development Workflow

1. **Morning**: `./dev.sh up`
2. **Code**: Edit files, see changes instantly
3. **Debug**: `./dev.sh logs` to see what's happening
4. **Evening**: `./dev.sh down`

---

## Before Deploying

Always test the production build:
```bash
./dev.sh prod
# Test at http://localhost:3000
# If good, deploy!
```

---

## Need More Info?

- **Full Docker Guide**: [DOCKER_GUIDE.md](./DOCKER_GUIDE.md)
- **Main README**: [README.md](./README.md)
- **Optimization Details**: [DOCKER_OPTIMIZATION.md](./DOCKER_OPTIMIZATION.md)

Happy coding! 🎮🚀

