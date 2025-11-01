// Application constants
export const APP_CONFIG = {
  WS_PORT: 3001,
  API_PORT: 3000,
  POLL_INTERVAL: 2000,
  TAP_EFFECT_DURATION: 600,
  SESSION_TIMEOUT: 30000,
  HEARTBEAT_INTERVAL: 3000,
} as const;

// WebSocket configuration
export const WS_CONFIG = {
  RECONNECT_INTERVAL: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
  PING_INTERVAL: 30000,
} as const;

// Kafka topics
export const KAFKA_TOPICS = {
  GAME_TAPS: 'game-taps',
  GAME_UPDATES: 'game-updates',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  USER: 'sw_user',
  SESSION: 'sw_session',
} as const;

// Broadcast channel name
export const BROADCAST_CHANNEL = 'sw_channel' as const;

// Leaderboard config
export const LEADERBOARD_CONFIG = {
  TOP_PLAYERS: 20,
  DISPLAY_TOP: 10,
} as const;

