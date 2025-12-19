import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { getGeoLocation } from './geolocation';
import {
  publishClientPerformance,
  publishEngagementPattern,
  publishFunAnomaly,
  publishSessionEvent,
  publishTeamDynamics,
} from './kafka-producer-analytics';
import { parseUserAgent, publishUserMetadata } from './kafka-producer-metadata';
import {
  addUser,
  balanceTeamAssignment,
  connectRedis,
  decrementActiveSessions,
  getAllUsers,
  getGameState,
  getLeaderboard,
  getUser,
  incrementActiveSessions,
  incrementReconnectCount,
  removeUser,
  trackSessionStart,
  trackVisit,
  updateUserDisconnectTime,
} from './redis';
import type {
  ClientPerformanceEvent,
  EngagementPatternEvent,
  FunAnomalyEvent,
  SessionEvent,
  TeamDynamicsEvent,
  User,
  UserMetadataEvent,
  WebSocketMessage,
} from './types';
import { generateId } from './utils';

class StandaloneWebSocketServer {
  private wss: WebSocketServer | null = null;
  private server: Server | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private clientToUserId: Map<string, string> = new Map();
  private clientMetadata: Map<string, { userAgent?: string; ip?: string; language?: string }> = new Map();
  private clientPingTimes: Map<string, number> = new Map(); // For latency tracking

  async start(port: number = 3001): Promise<void> {
    // Connect to Redis first
    await connectRedis();
    
    // Create a simple HTTP server for WebSocket upgrade
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      try {
        if (req.method === 'GET' && req.url === '/state') {
          // Handle async state fetch
          this.handleStateRequest(res);
          return;
        }
        res.statusCode = 404;
        res.end('Not found');
      } catch (error) {
        console.error('HTTP server error:', error);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });
    
    this.wss = new WebSocketServer({ 
      server: this.server,
      perMessageDeflate: false 
    });
    
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = generateId();
      this.clients.set(clientId, ws);
      
      // Capture connection metadata
      const userAgent = req.headers['user-agent'];
      const ip = req.socket.remoteAddress;
      const language = req.headers['accept-language'];
      
      this.clientMetadata.set(clientId, {
        userAgent,
        ip,
        language,
      });
      
      console.log(`Game client connected: ${clientId} from ${ip}`);
      
      ws.on('message', (data: Buffer) => {
        try {
          const rawMessage = JSON.parse(data.toString());
          
          // Handle ping/pong for latency measurement
          if (rawMessage.type === 'ping') {
            const pingTime = this.clientPingTimes.get(clientId);
            if (pingTime) {
              const latency = Date.now() - pingTime;
              this.clientPingTimes.delete(clientId);
              this.handleLatencyMeasurement(clientId, latency);
            }
            // Send pong back
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            return;
          }
          
          const message = rawMessage as WebSocketMessage;
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Send periodic ping for latency measurement (every 10 seconds)
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          this.clientPingTimes.set(clientId, Date.now());
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } else {
          clearInterval(pingInterval);
        }
      }, 10000);
      
      ws.on('close', () => {
        clearInterval(pingInterval);
      });
      
      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });
      
      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientDisconnect(clientId);
      });
      
      // Send current game state to new client
      this.sendInitialState(clientId);
    });

    const hostname = process.env.HOSTNAME || '0.0.0.0';
    this.server.listen(port, hostname, () => {
      console.log(`Game WebSocket server running on ws://${hostname}:${port}`);
    });
  }

  private async handleMessage(clientId: string, message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'user_join':
        await this.handleUserJoin(clientId, message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }
  
  private async handleStateRequest(res: ServerResponse): Promise<void> {
    try {
      const payload = {
        gameState: await getGameState(),
        users: await getAllUsers(),
        leaderboard: await getLeaderboard(),
      };
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(payload));
    } catch (error) {
      console.error('Error fetching state:', error);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }
  
  private async sendInitialState(clientId: string): Promise<void> {
    try {
      const gameState = await getGameState();
      this.sendToClient(clientId, {
        type: 'game_update',
        data: { gameState },
      });
    } catch (error) {
      console.error('Error sending initial state:', error);
    }
  }


  private async handleClientDisconnect(clientId: string): Promise<void> {
    this.clients.delete(clientId);
    this.clientMetadata.delete(clientId);
    await this.handleUserLeave(clientId);
    console.log(`Game client disconnected: ${clientId}`);
  }

  private async handleUserJoin(clientId: string, userData: Partial<User>): Promise<void> {
    try {
      // Check if user already exists in Redis (reconnecting user)
      let existingUser: User | null = null;
      if (userData.id) {
        existingUser = await getUser(userData.id);
      }
      
      // IMPORTANT: Keep team assignment consistent between client and server
      // Priority:
      // 1) Existing Redis user team (reconnects)
      // 2) Team sent from client on first join
      // 3) Fallback to balanced assignment if no team provided
      const finalTeam: 'blue' | 'red' =
        (existingUser?.team as 'blue' | 'red' | undefined) ??
        (userData.team as 'blue' | 'red' | undefined) ??
        (await balanceTeamAssignment());
      
      // Get metadata from the connection
      const connectionMetadata = this.clientMetadata.get(clientId);
      
      // Parse user agent if available
      let parsedUserAgent = {};
      if (connectionMetadata?.userAgent) {
        parsedUserAgent = parseUserAgent(connectionMetadata.userAgent);
      }

      // CRITICAL: Use Redis as the single source of truth for tap counts
      // If user exists in Redis, use their stored tap count
      // If new user, start at 0
      // We do NOT use the client's localStorage tap count because:
      // 1. It can get out of sync with Redis
      // 2. It can cause double-counting issues
      // 3. Redis + Kafka is our authoritative system
      const serverTapCount = existingUser?.tapCount || 0;
      
      // Check if this is a comeback (user reconnecting after disconnect)
      const isComeback = !!existingUser && !!existingUser.lastDisconnectTime;
      const reconnectCount = isComeback 
        ? await incrementReconnectCount(userData.id || clientId)
        : (existingUser?.reconnectCount || 0);

      // Get geolocation from IP (async, don't block)
      const sessionStartTime = Date.now();
      const geoLocation = {};
      if (connectionMetadata?.ip) {
        getGeoLocation(connectionMetadata.ip)
          .then(location => {
            // Update user metadata with geolocation
            getUser(userData.id || clientId)
              .then(u => {
                if (u) {
                  u.meta = { ...u.meta, ...location };
                  addUser(u);
                }
              })
              .catch(err => console.warn('Error updating user with geolocation:', err));
          })
          .catch(err => console.warn('Failed to get geolocation:', err));
      }

      const user: User = {
        id: userData.id || clientId,
        username: userData.username || 'Anonymous',
        team: finalTeam,
        sessionId: userData.sessionId || '',
        tapCount: serverTapCount,
        lastTapTime: existingUser?.lastTapTime || Date.now(),
        sessionStartTime,
        reconnectCount,
        meta: {
          ...userData.meta,
          userAgent: connectionMetadata?.userAgent,
          ip: connectionMetadata?.ip,
          language: connectionMetadata?.language,
          ...parsedUserAgent,
          ...geoLocation,
        },
      };
      
      // Track session start
      await trackSessionStart(user.id, user.sessionId, sessionStartTime);
      
      // Track visit and engagement patterns
      const visitInfo = await trackVisit(user.id, sessionStartTime);
      
      // Track active sessions for multi-tab detection
      const activeSessions = await incrementActiveSessions(user.id);
      
      // Get game state for team dynamics
      const currentGameState = await getGameState();
      const userTeamScore = user.team === 'blue' ? currentGameState.blueScore : currentGameState.redScore;
      
      // Publish engagement patterns
      try {
        const now = new Date();
        const hourOfDay = now.getHours();
        const dayOfWeek = now.getDay();
        
        // Peak hours (9 AM - 5 PM)
        if (hourOfDay >= 9 && hourOfDay <= 17) {
          const pattern: EngagementPatternEvent = {
            id: generateId(),
            userId: user.id,
            username: user.username,
            timestamp: sessionStartTime,
            patternType: 'peak_hour',
            metadata: {
              hourOfDay,
              dayOfWeek,
            },
          };
          publishEngagementPattern(pattern).catch(err => console.error('Error publishing peak hour:', err));
        }
        
        // Night owl (10 PM - 2 AM)
        if (hourOfDay >= 22 || hourOfDay <= 2) {
          const pattern: EngagementPatternEvent = {
            id: generateId(),
            userId: user.id,
            username: user.username,
            timestamp: sessionStartTime,
            patternType: 'night_owl',
            metadata: {
              hourOfDay,
              dayOfWeek,
            },
          };
          publishEngagementPattern(pattern).catch(err => console.error('Error publishing night owl:', err));
        }
        
        // Early bird (5 AM - 8 AM)
        if (hourOfDay >= 5 && hourOfDay <= 8) {
          const pattern: EngagementPatternEvent = {
            id: generateId(),
            userId: user.id,
            username: user.username,
            timestamp: sessionStartTime,
            patternType: 'early_bird',
            metadata: {
              hourOfDay,
              dayOfWeek,
            },
          };
          publishEngagementPattern(pattern).catch(err => console.error('Error publishing early bird:', err));
        }
        
        // Return visit
        if (visitInfo.isReturnVisit) {
          const pattern: EngagementPatternEvent = {
            id: generateId(),
            userId: user.id,
            username: user.username,
            timestamp: sessionStartTime,
            patternType: 'return_visit',
            metadata: {
              visitCount: visitInfo.visitCount,
              lastVisitTime: visitInfo.lastVisitTime || undefined,
            },
          };
          publishEngagementPattern(pattern).catch(err => console.error('Error publishing return visit:', err));
        }
      } catch (error) {
        console.error('Error publishing engagement patterns:', error);
      }
      
      // Detect multi-tab warriors
      if (activeSessions > 1) {
        const anomaly: FunAnomalyEvent = {
          id: generateId(),
          userId: user.id,
          username: user.username,
          timestamp: sessionStartTime,
          anomalyType: 'multi_tab_warrior',
          metadata: {
            activeSessions,
          },
        };
        publishFunAnomaly(anomaly).catch(err => console.error('Error publishing multi-tab anomaly:', err));
      }
      
      // Detect late game heroes (joining when team is significantly behind)
      const opponentScore = user.team === 'blue' ? currentGameState.redScore : currentGameState.blueScore;
      const scoreDifference = opponentScore - userTeamScore;
      if (scoreDifference > 100) { // Team is behind by 100+ points
        const dynamics: TeamDynamicsEvent = {
          id: generateId(),
          userId: user.id,
          username: user.username,
          team: user.team,
          timestamp: sessionStartTime,
          eventType: 'late_game_hero',
          metadata: {
            joinedAtScore: userTeamScore,
            currentScore: userTeamScore,
            impact: 0, // Will be calculated later
          },
        };
        publishTeamDynamics(dynamics).catch(err => console.error('Error publishing late game hero:', err));
      }
      
      // Add user to Redis (or update if reconnecting)
      // Team scores are ONLY updated via Kafka tap events, not here
      await addUser(user);
      
      // Keep track of which client is which user
      this.clientToUserId.set(clientId, user.id);
      
      // Publish session start event
      try {
        const sessionEvent: SessionEvent = {
          id: generateId(),
          userId: user.id,
          username: user.username,
          sessionId: user.sessionId,
          eventType: isComeback ? 'comeback' : 'session_start',
          timestamp: sessionStartTime,
          team: user.team,
          metadata: isComeback ? {
            previousDisconnectTime: existingUser?.lastDisconnectTime,
            reconnectCount,
          } : undefined,
        };
        
        await publishSessionEvent(sessionEvent);
      } catch (error) {
        console.error('Error publishing session event:', error);
      }
      
      // Publish user metadata to Kafka
      try {
        const metadataEvent: UserMetadataEvent = {
          id: generateId(),
          userId: user.id,
          username: user.username,
          sessionId: user.sessionId,
          timestamp: Date.now(),
          metadata: user.meta || {},
          connectionInfo: {
            clientId,
            ipAddress: connectionMetadata?.ip,
            connectionTime: Date.now(),
          },
        };
        
        await publishUserMetadata(metadataEvent);
      } catch (error) {
        console.error('Error publishing user metadata to Kafka:', error);
        // Don't fail the user join if Kafka publish fails
      }
      
      console.log(`User ${existingUser ? 'rejoined' : 'added'}: ${user.username} (ID: ${user.id}, Team: ${user.team}, Taps: ${user.tapCount})`);
      
      // Send the user's own data back to them first
      const finalGameState = await getGameState();
      this.sendToClient(clientId, {
        type: 'game_update',
        data: {
          gameState: finalGameState,
          user: user,
        },
      });
      
      // Broadcast to all OTHER clients (not the one that just joined)
      this.broadcastExcept(clientId, {
        type: 'game_update',
        data: {
          gameState: finalGameState,
        },
      });
    } catch (error) {
      console.error('Error handling user join:', error);
    }
  }

  private async handleUserLeave(clientId: string): Promise<void> {
    try {
      const userId = this.clientToUserId.get(clientId);
      if (userId) {
        const user = await getUser(userId);
        const disconnectTime = Date.now();
        
        if (user) {
          // Decrement active sessions
          await decrementActiveSessions(userId);
          
          // Update disconnect time
          await updateUserDisconnectTime(userId, disconnectTime);
          
          // Calculate session duration
          const sessionDuration = user.sessionStartTime 
            ? disconnectTime - user.sessionStartTime 
            : undefined;
          
          // Get game state to check if user's team was losing (rage quit detection)
          const gameState = await getGameState();
          const userTeamScore = user.team === 'blue' ? gameState.blueScore : gameState.redScore;
          const opponentScore = user.team === 'blue' ? gameState.redScore : gameState.blueScore;
          const wasLosing = userTeamScore < opponentScore;
          
          // Detect rage quit: disconnected within 5 seconds of last tap while losing
          const timeSinceLastTap = disconnectTime - (user.lastTapTime || 0);
          const isRageQuit = wasLosing && timeSinceLastTap < 5000 && user.tapCount > 0;
          
          // Detect marathon player: session > 30 minutes
          const isMarathon = sessionDuration && sessionDuration > 30 * 60 * 1000;
          
          // Detect spectator mode: connected but never tapped
          const isSpectator = user.tapCount === 0 && sessionDuration && sessionDuration > 60 * 1000; // 1+ minute, no taps
          if (isSpectator) {
            const anomaly: FunAnomalyEvent = {
              id: generateId(),
              userId: user.id,
              username: user.username,
              timestamp: disconnectTime,
              anomalyType: 'spectator_mode',
              metadata: {
                sessionDuration,
                tapCount: 0,
              },
            };
            publishFunAnomaly(anomaly).catch(err => console.error('Error publishing spectator mode:', err));
          }
          
          // Publish session end event
          try {
            const sessionEvent: SessionEvent = {
              id: generateId(),
              userId: user.id,
              username: user.username,
              sessionId: user.sessionId,
              eventType: isRageQuit ? 'rage_quit' : isMarathon ? 'marathon' : 'session_end',
              timestamp: disconnectTime,
              sessionDuration,
              tapCountAtEvent: user.tapCount,
              team: user.team,
            };
            
            await publishSessionEvent(sessionEvent);
          } catch (error) {
            console.error('Error publishing session end event:', error);
          }
        }
        
        await removeUser(userId);
        this.clientToUserId.delete(clientId);
        this.clientPingTimes.delete(clientId);
        
        console.log(`User removed: ${userId}`);
        
        this.broadcast({
          type: 'user_left',
          data: { id: userId },
        });
        
        // Broadcast updated game state
        await this.broadcastGameUpdate();
      }
    } catch (error) {
      console.error('Error handling user leave:', error);
    }
  }
  
  /**
   * Handle latency measurement from ping/pong
   */
  private async handleLatencyMeasurement(clientId: string, latency: number): Promise<void> {
    try {
      const userId = this.clientToUserId.get(clientId);
      if (!userId) return;
      
      const user = await getUser(userId);
      if (!user) return;
      
      // Determine connection quality
      let connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
      if (latency < 50) {
        connectionQuality = 'excellent';
      } else if (latency < 150) {
        connectionQuality = 'good';
      } else if (latency < 300) {
        connectionQuality = 'fair';
      } else {
        connectionQuality = 'poor';
      }
      
      // Detect lag warrior: high latency but still competitive (has taps)
      const isLagWarrior = latency > 300 && user.tapCount > 10;
      
      // Publish client performance event (throttle to once per minute per user)
      const performanceEvent: ClientPerformanceEvent = {
        id: generateId(),
        userId,
        username: user.username,
        timestamp: Date.now(),
        latency,
        connectionQuality,
        isLagWarrior,
        metadata: {
          pingTime: Date.now() - latency,
          pongTime: Date.now(),
          reconnectCount: user.reconnectCount,
        },
      };
      
      publishClientPerformance(performanceEvent).catch(err => 
        console.error('Error publishing client performance:', err)
      );
    } catch (error) {
      console.error('Error handling latency measurement:', error);
    }
  }

  async broadcastGameUpdate(updatedUser?: User): Promise<void> {
    try {
      const gameState = await getGameState();
      
      // Send updates to all clients
      // For the user who triggered the update, include their user data
      // For other clients, just send the game state
      this.clients.forEach((client, clientId) => {
        if (client.readyState === WebSocket.OPEN) {
          const userId = this.clientToUserId.get(clientId);
          const includeUserData = updatedUser && userId === updatedUser.id;
          
          const message = {
            type: 'game_update' as const,
        data: {
          gameState,
              ...(includeUserData ? { user: updatedUser } : {}),
        },
          };
          
          client.send(JSON.stringify(message));
        }
      });
    } catch (error) {
      console.error('Error broadcasting game update:', error);
    }
  }

  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  private broadcast(message: WebSocketMessage): void {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  private broadcastExcept(excludeClientId: string, message: WebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

export const standaloneWebSocketServer = new StandaloneWebSocketServer();
