import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GameState, User, WebSocketMessage } from './types';

class StandaloneWebSocketServer {
  private wss: WebSocketServer | null = null;
  private server: any;
  private clients: Map<string, any> = new Map();
  private gameState: GameState = {
    blueScore: 0,
    redScore: 0,
    totalTaps: 0,
    activeUsers: 0,
    lastUpdated: Date.now(),
  };
  private users: Map<string, User> = new Map();
  private clientToUserId: Map<string, string> = new Map(); // Map clientId to userId

  start(port: number = 3001) {
    // Create a simple HTTP server for WebSocket upgrade
    this.server = createServer();
    
    this.wss = new WebSocketServer({ 
      server: this.server,
      perMessageDeflate: false 
    });
    
    this.wss.on('connection', (ws: any, req: any) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      
      console.log(`Game client connected: ${clientId}`);
      
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        this.clients.delete(clientId);
        this.removeUser(clientId);
        console.log(`Game client disconnected: ${clientId}`);
      });
      
      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
        this.removeUser(clientId);
      });
      
      // Send current game state to new client
      this.sendToClient(clientId, {
        type: 'game_update',
        data: this.gameState,
      });
    });

    this.server.listen(port, () => {
      console.log(`🎮 Game WebSocket server running on ws://localhost:${port}`);
    });
  }

  private generateClientId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private handleMessage(clientId: string, message: any) {
    switch (message.type) {
      case 'user_join':
        this.addUser(clientId, message.data);
        break;
      case 'user_leave':
        this.removeUser(clientId);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private addUser(clientId: string, userData: Partial<User>) {
    const user: User = {
      id: userData.id || clientId, // Use provided ID or fallback to clientId
      username: userData.username || 'Anonymous',
      team: userData.team || 'blue',
      sessionId: userData.sessionId || '',
      tapCount: 0,
      lastTapTime: Date.now(),
      meta: userData.meta,
    };
    
    // Store user by their actual userId, not clientId
    this.users.set(user.id, user);
    // Keep track of which client is which user
    this.clientToUserId.set(clientId, user.id);
    this.updateGameState();
    
    console.log(`User added: ${user.username} (ID: ${user.id}, Team: ${user.team})`);
    
    this.broadcast({
      type: 'user_joined',
      data: user,
    });
  }

  private removeUser(clientId: string) {
    const userId = this.clientToUserId.get(clientId);
    if (userId && this.users.has(userId)) {
      this.users.delete(userId);
      this.clientToUserId.delete(clientId);
      this.updateGameState();
      
      console.log(`User removed: ${userId}`);
      
      this.broadcast({
        type: 'user_left',
        data: { id: userId },
      });
    }
  }

  private updateGameState() {
    let blueScore = 0;
    let redScore = 0;
    let totalTaps = 0;
    
    this.users.forEach(user => {
      totalTaps += user.tapCount;
      if (user.team === 'blue') {
        blueScore += user.tapCount;
      } else {
        redScore += user.tapCount;
      }
    });
    
    this.gameState = {
      blueScore,
      redScore,
      totalTaps,
      activeUsers: this.users.size,
      lastUpdated: Date.now(),
    };
  }

  updateUserTaps(userId: string, tapCount: number) {
    const user = this.users.get(userId);
    if (user) {
      user.tapCount = tapCount;
      user.lastTapTime = Date.now();
      this.updateGameState();
      
      this.broadcast({
        type: 'game_update',
        data: this.gameState,
      });
    }
  }

  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (client && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  }

  private broadcast(message: WebSocketMessage) {
    this.clients.forEach((client, clientId) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    });
  }

  getGameState(): GameState {
    return this.gameState;
  }

  getUsers(): User[] {
    return Array.from(this.users.values());
  }

  getLeaderboard(): User[] {
    return Array.from(this.users.values())
      .sort((a, b) => b.tapCount - a.tapCount)
      .slice(0, 10);
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

export const standaloneWebSocketServer = new StandaloneWebSocketServer();
