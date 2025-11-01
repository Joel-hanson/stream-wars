// Team type
export type Team = 'blue' | 'red';

// User metadata
export interface UserMeta {
  ip?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: string;
  language?: string;
}

// Tap event structure
export interface TapEvent {
  id: string;
  userId: string;
  username: string;
  team: Team;
  timestamp: number;
  sessionId: string;
}

// User metadata event structure
export interface UserMetadataEvent {
  id: string;
  userId: string;
  username: string;
  sessionId: string;
  timestamp: number;
  metadata: UserMeta;
  connectionInfo: {
    clientId: string;
    ipAddress?: string;
    connectionTime: number;
  };
}

// Game state structure
export interface GameState {
  blueScore: number;
  redScore: number;
  totalTaps: number;
  activeUsers: number;
  lastUpdated: number;
}

// User structure
export interface User {
  id: string;
  username: string;
  team: Team;
  sessionId: string;
  tapCount: number;
  lastTapTime: number;
  meta?: UserMeta;
}

// Leaderboard entry
export interface LeaderboardEntry {
  username: string;
  team: Team;
  tapCount: number;
  rank: number;
}

// WebSocket message types
export type WebSocketMessageType = 
  | 'game_update' 
  | 'user_joined' 
  | 'user_left' 
  | 'leaderboard_update'
  | 'user_join';

export interface GameUpdateData {
  gameState: GameState;
  user?: User;
}

export interface UserJoinedData {
  user: User;
}

export interface UserLeftData {
  id: string;
}

// WebSocket message union type
export type WebSocketMessage =
  | { type: 'game_update'; data: GameUpdateData }
  | { type: 'user_joined'; data: User }
  | { type: 'user_left'; data: UserLeftData }
  | { type: 'user_join'; data: Partial<User> }
  | { type: 'leaderboard_update'; data: LeaderboardEntry[] };

// API response types
export interface GameStateResponse {
  gameState: GameState;
  users: User[];
  leaderboard: LeaderboardEntry[];
}

export interface TapResponse {
  success: boolean;
  tapEvent: TapEvent;
}

export interface ErrorResponse {
  error: string;
}
