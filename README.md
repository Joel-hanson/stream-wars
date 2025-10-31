# Stream Wars - Real-time Tap Battle Game

A real-time multiplayer tap battle game built with Next.js, Kafka, and WebSockets. Players are automatically assigned to Team Blue or Team Red and compete by tapping to score points for their team.

## Features

- 🎮 **Real-time multiplayer gameplay** with WebSocket connections
- 🔄 **Kafka integration** for scalable event streaming
- 📱 **Mobile-first responsive design**
- 🏆 **Live leaderboard** with top players
- ⚡ **Instant score updates** across all connected players
- 🎨 **Beautiful animations** with Framer Motion
- 🐳 **Docker Compose** for easy local development

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, WebSocket Server
- **Message Queue**: Apache Kafka latest (KRaft mode) with KafkaJS
- **Real-time**: WebSocket connections
- **Styling**: Tailwind CSS with custom animations
- **Deployment**: Docker & Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- Git

### 1. Clone and Install

```bash
git clone <repository-url>
cd stream-wars
npm install
```

### 2. Start Development Environment

**Option A: Using Docker (Recommended - Everything included!)**

```bash
# Start everything (app, Kafka, Redis) with hot reload
docker-compose -f docker-compose.dev.yml up

# Or use the helper script
./dev.sh up        # Start in background
./dev.sh logs      # View logs
./dev.sh down      # Stop everything

# Access the game at http://localhost:3000
```

**Option B: Local Development (Manual setup)**

```bash
# Start only Kafka and Redis
docker-compose up kafka redis -d
```

### 3. Environment Setup (Optional for local development)

Only needed if running locally without Docker:

Create a `.env.local` file:

```env
# Kafka Configuration (use 127.0.0.1 to avoid IPv6 issues)
KAFKA_BROKERS=127.0.0.1:9092
KAFKA_USERNAME=
KAFKA_PASSWORD=
KAFKA_SSL=false
KAFKA_TOPIC=game-taps

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Application Configuration
NEXTAUTH_SECRET=your-secret-key-here
NODE_ENV=development
```

### 4. Start the Application (Local Development Only)

Only if not using Docker:

```bash
# Development mode (runs both Next.js app and WebSocket server)
npm run dev

# Or run them separately:
# Terminal 1: Next.js app (port 3000)
npm run dev:app

# Terminal 2: WebSocket server (port 3001)
npm run dev:ws
```

**Note**: The application runs on two ports:
- **Next.js app**: http://localhost:3000
- **WebSocket server**: ws://localhost:3001

### 5. Access the Game

- **Game**: http://localhost:3000
- **Kafka UI**: http://localhost:8080 (for monitoring)
- **Leaderboard**: http://localhost:3000/leaderboard

## How It Works

### Game Flow

1. **User Joins**: Players are automatically assigned to Team Blue or Red (50/50 distribution)
2. **Tap Events**: Each tap sends a message to Kafka topic `game-taps`
3. **Kafka Consumer**: Processes tap events and updates game state
4. **WebSocket Broadcast**: Real-time updates sent to all connected players
5. **Live Leaderboard**: Top players displayed with team affiliations

### Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │   Next.js   │    │   Kafka     │
│   (React)   │◄──►│   API + WS  │◄──►│ (KRaft)     │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │  Consumer   │
                   │   Service    │
                   └─────────────┘
```

### Key Components

- **TapButton**: Large, animated tap interface with team colors
- **ScoreDisplay**: Real-time progress bars and team scores
- **UserInfo**: Player stats and team assignment
- **Leaderboard**: Top players with rankings and team colors

## Development

### Testing WebSocket Connection

To test the WebSocket connection:

1. **Start the development server** in one terminal:
```bash
npm run dev
```

2. **Run the WebSocket test** in another terminal:
```bash
npm run test:ws
```

The test will:
- Connect to the WebSocket server on port 3001
- Send a test message with user data
- Receive game state updates
- Display all received messages

If you see "socket hang up" or "ECONNREFUSED" errors, make sure both servers are running:
```bash
npm run dev
```

**Note**: The game WebSocket runs on a separate port (3001) to avoid conflicts with Next.js HMR WebSocket.

### Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── leaderboard/       # Leaderboard page
│   └── page.tsx          # Main game page
├── components/            # React components
│   ├── TapButton.tsx     # Main tap interface
│   ├── ScoreDisplay.tsx  # Team scores
│   └── UserInfo.tsx      # Player info
├── lib/                  # Utilities and services
│   ├── kafka.ts         # Kafka configuration
│   ├── websocket.ts     # WebSocket server
│   ├── types.ts         # TypeScript types
│   └── utils.ts         # Helper functions
```

### Adding Features

1. **New Game Modes**: Extend the `GameState` type and add new API routes
2. **Custom Animations**: Add new Framer Motion animations to components
3. **Team Customization**: Modify team assignment logic in `utils.ts`
4. **Scoring Rules**: Update Kafka consumer logic for different scoring

## Docker Modes

This project has **two Docker configurations**:

### 🔧 Development Mode (Recommended for Local Work)

**Fast, with hot reload - no build needed!**

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Or use helper script
./dev.sh up        # Start in background
./dev.sh logs      # View logs
./dev.sh down      # Stop
```

**Features:**
- ✅ Hot reload - changes reflect immediately
- ✅ No build step - starts in ~30 seconds
- ✅ Full dev tools and debugging
- ✅ Volume mounting - edit code on your machine

### 🚀 Production Mode (Optimized Build)

**Optimized for deployment - 50-60% smaller & faster!**

```bash
# Build and start production environment
docker-compose up --build

# Or use helper script
./dev.sh prod

# Measure optimizations
./measure-optimization.sh
```

**Features:**
- ⚡ 50-60% smaller images (400-600MB vs 1.2GB)
- ⚡ 30-40% faster builds
- ⚡ 50-60% faster startup
- 🔒 Enhanced security (non-root, minimal deps)

📚 **See detailed guide**: [DOCKER_GUIDE.md](./DOCKER_GUIDE.md)

## Deployment

### Production Deployment

```bash
# Build and start all services (optimized)
docker-compose up --build -d

# Or use the production config explicitly
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables

For production deployment, configure:

- `KAFKA_BROKERS`: Your Kafka cluster endpoints
- `KAFKA_USERNAME`/`KAFKA_PASSWORD`: Authentication credentials
- `NEXT_PUBLIC_WS_URL`: WebSocket URL for client connections

## Monitoring

- **Kafka UI**: Monitor message flow and topics at http://localhost:8080
- **Application Logs**: Check console for WebSocket and Kafka events
- **Performance**: Monitor WebSocket connections and message throughput

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker Compose
5. Submit a pull request

## License

MIT License - feel free to use this project for learning and development!