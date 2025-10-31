import { IncomingMessage } from 'http';
import { WebSocketServer } from 'ws';
import { GameState, User, WebSocketMessage } from './types';

class GameWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, any> = new Map();
  private gameState: GameState = {
    blueScore: 0,
    redScore: 0,
    totalTaps: 0,
    activeUsers: 0,
    lastUpdated: Date.now(),
  };
  private users: Map<string, User> = new Map();

  initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/game-ws',
      perMessageDeflate: false 
    });
    
    this.wss.on('connection', (ws: any, req: IncomingMessage) => {
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
        console.log(`Client disconnected: ${clientId}`);
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
      id: clientId,
      username: userData.username || 'Anonymous',
      team: userData.team || 'blue',
      sessionId: userData.sessionId || '',
      tapCount: 0,
      lastTapTime: Date.now(),
      ...userData,
    };
    
    this.users.set(clientId, user);
    this.updateGameState();
    
    this.broadcast({
      type: 'user_joined',
      data: user,
    });
  }

  private removeUser(clientId: string) {
    if (this.users.has(clientId)) {
      this.users.delete(clientId);
      this.updateGameState();
      
      this.broadcast({
        type: 'user_left',
        data: { id: clientId },
      });
    }
  }

  updateGameState() {
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
}

export const gameWebSocketServer = new GameWebSocketServer();
