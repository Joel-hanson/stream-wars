export interface TapEvent {
  id: string;
  userId: string;
  username: string;
  team: 'blue' | 'red';
  timestamp: number;
  sessionId: string;
}

export interface GameState {
  blueScore: number;
  redScore: number;
  totalTaps: number;
  activeUsers: number;
  lastUpdated: number;
}

export interface User {
  id: string;
  username: string;
  team: 'blue' | 'red';
  sessionId: string;
  tapCount: number;
  lastTapTime: number;
  meta?: {
    ip?: string;
    userAgent?: string;
    browser?: string;
    os?: string;
    device?: string;
    language?: string;
  };
}

export interface LeaderboardEntry {
  username: string;
  team: 'blue' | 'red';
  tapCount: number;
  rank: number;
}

export interface WebSocketMessage {
  type: 'game_update' | 'user_joined' | 'user_left' | 'leaderboard_update';
  data: GameState | User | LeaderboardEntry[] | any;
}
