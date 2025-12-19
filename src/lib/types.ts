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
  country?: string;
  city?: string;
  region?: string;
}

// Tap event structure
export interface TapEvent {
  id: string;
  userId: string;
  username: string;
  team: Team;
  timestamp: number;
  sessionId: string;
  // Tap intensity metrics
  tapVelocity?: number; // Taps per second
  timeSinceLastTap?: number; // Milliseconds since last tap
  burstCount?: number; // Number of taps in current burst (within 1 second)
  maxBurst?: number; // Maximum burst achieved in this session
  isFrenzyMode?: boolean; // Sustained high tap rate (>5 taps/sec for 3+ seconds)
  sessionDuration?: number; // Milliseconds since session start
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
  sessionStartTime?: number; // When the session started
  lastDisconnectTime?: number; // When user last disconnected (for comeback detection)
  reconnectCount?: number; // Number of times user reconnected
  firstTapTime?: number; // When user made their first tap
  previousTapCount?: number; // For tracking improvement
  previousTapVelocity?: number; // For tracking acceleration
  activeSessions?: number; // For multi-tab detection
  lastVisitTime?: number; // For return visit tracking
  visitCount?: number; // Total number of visits
  streakLength?: number; // Consecutive days played
}

// Leaderboard entry
export interface LeaderboardEntry {
  username: string;
  team: Team;
  tapCount: number;
  rank: number;
}

// Session event structure
export interface SessionEvent {
  id: string;
  userId: string;
  username: string;
  sessionId: string;
  eventType: 'session_start' | 'session_end' | 'comeback' | 'rage_quit' | 'marathon';
  timestamp: number;
  sessionDuration?: number; // Milliseconds
  tapCountAtEvent?: number;
  team?: Team;
  metadata?: {
    previousDisconnectTime?: number;
    reconnectCount?: number;
    isMarathon?: boolean; // Session > 30 minutes
  };
}

// Analytics event for device/browser battles
export interface DeviceBrowserAnalytics {
  id: string;
  timestamp: number;
  metricType: 'device_battle' | 'browser_battle' | 'os_battle';
  category: string; // e.g., 'Chrome', 'Mobile', 'Windows'
  team: Team;
  score: number;
  tapCount: number;
  activeUsers: number;
}

// Power rankings event
export interface PowerRankingEvent {
  id: string;
  userId: string;
  username: string;
  team: Team;
  timestamp: number;
  rankingType: 'most_improved' | 'consistency_king' | 'sprint_champion' | 'endurance_master';
  value: number; // The metric value (e.g., taps/min acceleration, consistency score)
  metadata?: {
    previousValue?: number;
    improvement?: number;
    sessionDuration?: number;
    burstCount?: number;
    tapCount?: number;
  };
}

// Team dynamics event
export interface TeamDynamicsEvent {
  id: string;
  userId: string;
  username: string;
  team: Team;
  timestamp: number;
  eventType: 'first_tap' | 'late_game_hero' | 'team_switch' | 'lone_wolf';
  metadata: {
    timeToFirstTap?: number; // Milliseconds from join to first tap
    joinedAtScore?: number; // Team score when user joined
    currentScore?: number; // Team score now
    impact?: number; // Score contribution since joining
    sessionDuration?: number;
  };
}

// Client performance event
export interface ClientPerformanceEvent {
  id: string;
  userId: string;
  username: string;
  timestamp: number;
  latency?: number; // WebSocket ping/pong latency in ms
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  browserFPS?: number; // If available
  isLagWarrior?: boolean; // High latency but still competitive
  metadata?: {
    pingTime?: number;
    pongTime?: number;
    reconnectCount?: number;
  };
}

// Engagement pattern event
export interface EngagementPatternEvent {
  id: string;
  userId: string;
  username: string;
  timestamp: number;
  patternType: 'peak_hour' | 'night_owl' | 'early_bird' | 'return_visit' | 'streak';
  metadata: {
    hourOfDay?: number;
    dayOfWeek?: number;
    sessionCount?: number;
    streakLength?: number;
    lastVisitTime?: number;
    visitCount?: number;
  };
}

// Fun anomaly event
export interface FunAnomalyEvent {
  id: string;
  userId: string;
  username: string;
  timestamp: number;
  anomalyType: 'first_tap_speed' | 'multi_tab_warrior' | 'spectator_mode' | 'bot_suspicion';
  metadata: {
    timeToFirstTap?: number;
    activeSessions?: number;
    tapCount?: number;
    sessionDuration?: number;
    consistencyScore?: number; // For bot detection
  };
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
