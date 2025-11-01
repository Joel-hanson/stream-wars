import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { parseUserAgent, publishUserMetadata } from './kafka-producer-metadata';
import {
  addUser,
  balanceTeamAssignment,
  connectRedis,
  getAllUsers,
  getGameState,
  getLeaderboard,
  getUser,
  removeUser
} from './redis';
import type { GameState, User, UserMetadataEvent, WebSocketMessage } from './types';
import { generateId } from './utils';

class StandaloneWebSocketServer {
  private wss: WebSocketServer | null = null;
  private server: Server | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private clientToUserId: Map<string, string> = new Map();
  private clientMetadata: Map<string, { userAgent?: string; ip?: string; language?: string }> = new Map();

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
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
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

    this.server.listen(port, () => {
      console.log(`🎮 Game WebSocket server running on ws://localhost:${port}`);
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
      
      const assignedTeam = existingUser?.team || await balanceTeamAssignment();
      
      // Get metadata from the connection
      const connectionMetadata = this.clientMetadata.get(clientId);
      
      // Parse user agent if available
      let parsedUserAgent = {};
      if (connectionMetadata?.userAgent) {
        parsedUserAgent = parseUserAgent(connectionMetadata.userAgent);
      }

      const user: User = {
        id: userData.id || clientId,
        username: userData.username || 'Anonymous',
        team: existingUser?.team || assignedTeam,
        sessionId: userData.sessionId || '',
        tapCount: existingUser?.tapCount || 0,
        lastTapTime: existingUser?.lastTapTime || Date.now(),
        meta: {
          ...userData.meta,
          userAgent: connectionMetadata?.userAgent,
          ip: connectionMetadata?.ip,
          language: connectionMetadata?.language,
          ...parsedUserAgent,
        },
      };
      
      // Add user to Redis
      await addUser(user);
      
      // Keep track of which client is which user
      this.clientToUserId.set(clientId, user.id);
      
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
      const gameState = await getGameState();
      this.sendToClient(clientId, {
        type: 'game_update',
        data: {
          gameState,
          user: user,
        },
      });
      
      // Broadcast to all OTHER clients (not the one that just joined)
      this.broadcastExcept(clientId, {
        type: 'game_update',
        data: {
          gameState,
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
        await removeUser(userId);
        this.clientToUserId.delete(clientId);
        
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

  async broadcastGameUpdate(updatedUser?: User): Promise<void> {
    try {
      const gameState = await getGameState();
      
      this.broadcast({
        type: 'game_update',
        data: {
          gameState,
          user: updatedUser,
        },
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

  async getGameState(): Promise<GameState> {
    return await getGameState();
  }

  async getUsers(): Promise<User[]> {
    return await getAllUsers();
  }

  async getLeaderboard(): Promise<User[]> {
    return await getLeaderboard();
  }
  
  async getUser(userId: string): Promise<User | null> {
    return await getUser(userId);
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
