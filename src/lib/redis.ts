import Redis, { type RedisOptions } from 'ioredis';
import type { GameState, User } from './types';

let redis: Redis | null = null;

/**
 * Initialize Redis connection
 */
export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const redisPassword = process.env.REDIS_PASSWORD;
    
    const redisOptions: RedisOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    };
    
    // If REDIS_PASSWORD is provided as a separate env var, use it
    // Otherwise, the password should be in the REDIS_URL (format: redis://:password@host:port)
    if (redisPassword) {
      redisOptions.password = redisPassword;
    }
    
    redis = new Redis(redisUrl, redisOptions);

    redis.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis connected');
    });
  }

  return redis;
}

/**
 * Connect to Redis (should be called at app startup)
 */
export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  
  if (client.status !== 'ready') {
    await client.connect();
  }
}

// Redis Keys
export const REDIS_KEYS = {
  GAME_STATE: 'game:state',
  USERS: 'game:users', // Active users only (online)
  ALL_USERS: 'game:all_users', // All users who have ever played (persistent)
  USER_PREFIX: (userId: string) => `game:user:${userId}`,
  LEADERBOARD: 'game:leaderboard',
  TEAM_BLUE_SCORE: 'game:team:blue:score',
  TEAM_RED_SCORE: 'game:team:red:score',
  TOTAL_TAPS: 'game:total:taps',
  SESSION_PREFIX: (sessionId: string) => `game:session:${sessionId}`,
  USER_SESSIONS: (userId: string) => `game:user:${userId}:sessions`, // List of session IDs for a user
  TAP_HISTORY: (userId: string) => `game:user:${userId}:tap_history`, // Recent tap timestamps for velocity calculation
} as const;

/**
 * Redis State Management Functions
 */

/**
 * Get game state from Redis
 */
export async function getGameState(): Promise<GameState> {
  const client = getRedisClient();
  
  const [blueScore, redScore, totalTaps, activeUsers] = await Promise.all([
    client.get(REDIS_KEYS.TEAM_BLUE_SCORE),
    client.get(REDIS_KEYS.TEAM_RED_SCORE),
    client.get(REDIS_KEYS.TOTAL_TAPS),
    client.hlen(REDIS_KEYS.USERS),
  ]);

  return {
    blueScore: parseInt(blueScore || '0', 10),
    redScore: parseInt(redScore || '0', 10),
    totalTaps: parseInt(totalTaps || '0', 10),
    activeUsers,
    lastUpdated: Date.now(),
  };
}

/**
 * Add a user to Redis (active users + persistent storage)
 */
export async function addUser(user: User): Promise<void> {
  const client = getRedisClient();
  
  // Store user in active users hash (removed on disconnect)
  await client.hset(
    REDIS_KEYS.USERS,
    user.id,
    JSON.stringify(user)
  );
  
  // Also store in persistent all_users hash (never removed)
  await client.hset(
    REDIS_KEYS.ALL_USERS,
    user.id,
    JSON.stringify(user)
  );
  
  console.log(`User added to Redis: ${user.username} (${user.team})`);
}

/**
 * Get a user from Redis (checks active users first, then persistent storage)
 */
export async function getUser(userId: string): Promise<User | null> {
  const client = getRedisClient();
  
  // First check active users
  let userData = await client.hget(REDIS_KEYS.USERS, userId);
  
  // If not in active users, check persistent storage
  if (!userData) {
    userData = await client.hget(REDIS_KEYS.ALL_USERS, userId);
  }
  
  if (!userData) {
    return null;
  }
  
  return JSON.parse(userData) as User;
}

/**
 * Get all users from Redis
 */
export async function getAllUsers(): Promise<User[]> {
  const client = getRedisClient();
  
  const usersData = await client.hgetall(REDIS_KEYS.USERS);
  
  return Object.values(usersData).map(data => JSON.parse(data) as User);
}

/**
 * Remove a user from Redis
 */
export async function removeUser(userId: string): Promise<void> {
  const client = getRedisClient();
  
  await client.hdel(REDIS_KEYS.USERS, userId);
  
  console.log(`User removed from Redis: ${userId}`);
}

/**
 * Update user tap count and recalculate scores
 */
export async function incrementUserTaps(userId: string): Promise<User | null> {
  const client = getRedisClient();
  
  const user = await getUser(userId);
  
  if (!user) {
    console.log(`User ${userId} not found in Redis`);
    return null;
  }
  
  // Increment user's tap count
  user.tapCount += 1;
  user.lastTapTime = Date.now();
  
  // Update user in active users hash
  await client.hset(REDIS_KEYS.USERS, userId, JSON.stringify(user));
  
  // Also update in persistent all_users hash
  await client.hset(REDIS_KEYS.ALL_USERS, userId, JSON.stringify(user));
  
  // Increment team score
  const teamScoreKey = user.team === 'blue' 
    ? REDIS_KEYS.TEAM_BLUE_SCORE 
    : REDIS_KEYS.TEAM_RED_SCORE;
  
  await Promise.all([
    client.incr(teamScoreKey),
    client.incr(REDIS_KEYS.TOTAL_TAPS),
  ]);
  
  console.log(`Tap incremented for ${user.username} (${user.team}) - Total: ${user.tapCount}`);
  
  return user;
}

/**
 * Get all users who have ever played (including offline users)
 */
export async function getAllUsersEverPlayed(): Promise<User[]> {
  const client = getRedisClient();
  
  const usersData = await client.hgetall(REDIS_KEYS.ALL_USERS);
  
  return Object.values(usersData).map(data => JSON.parse(data) as User);
}

/**
 * Get leaderboard from Redis (includes offline users)
 */
export async function getLeaderboard(limit: number = 50): Promise<User[]> {
  // Get all users who have ever played (persistent storage)
  const users = await getAllUsersEverPlayed();
  
  return users
    .sort((a, b) => b.tapCount - a.tapCount)
    .slice(0, limit);
}

/**
 * Balance team assignment based on current Redis state
 */
export async function balanceTeamAssignment(): Promise<'blue' | 'red'> {
  const users = await getAllUsers();
  
  let blueCount = 0;
  let redCount = 0;
  
  users.forEach(user => {
    if (user.team === 'blue') blueCount++;
    else redCount++;
  });
  
  // If counts are equal, assign randomly
  if (blueCount === redCount) {
    return Math.random() < 0.5 ? 'blue' : 'red';
  }
  
  // Otherwise assign to team with fewer members
  return blueCount < redCount ? 'blue' : 'red';
}

/**
 * Reset all game state in Redis (for testing/admin purposes)
 */
export async function resetGameState(): Promise<void> {
  const client = getRedisClient();
  
  await Promise.all([
    client.del(REDIS_KEYS.USERS),
    client.del(REDIS_KEYS.ALL_USERS),
    client.del(REDIS_KEYS.TEAM_BLUE_SCORE),
    client.del(REDIS_KEYS.TEAM_RED_SCORE),
    client.del(REDIS_KEYS.TOTAL_TAPS),
  ]);
  
  console.log('Game state reset in Redis');
}

/**
 * Track session start
 */
export async function trackSessionStart(userId: string, sessionId: string, sessionStartTime: number): Promise<void> {
  const client = getRedisClient();
  
  // Store session info
  await client.setex(
    REDIS_KEYS.SESSION_PREFIX(sessionId),
    86400 * 7, // 7 days TTL
    JSON.stringify({
      userId,
      sessionId,
      startTime: sessionStartTime,
      tapCount: 0,
    })
  );
  
  // Add to user's session list
  await client.lpush(REDIS_KEYS.USER_SESSIONS(userId), sessionId);
  await client.ltrim(REDIS_KEYS.USER_SESSIONS(userId), 0, 99); // Keep last 100 sessions
}

/**
 * Get session info
 */
export async function getSessionInfo(sessionId: string): Promise<{ userId: string; sessionId: string; startTime: number; tapCount: number } | null> {
  const client = getRedisClient();
  const data = await client.get(REDIS_KEYS.SESSION_PREFIX(sessionId));
  if (!data) return null;
  return JSON.parse(data);
}

/**
 * Track tap timestamp for velocity calculation
 * Keeps last 20 tap timestamps (for burst detection)
 */
export async function trackTapTimestamp(userId: string, timestamp: number): Promise<number[]> {
  const client = getRedisClient();
  const key = REDIS_KEYS.TAP_HISTORY(userId);
  
  // Add new timestamp
  await client.lpush(key, timestamp.toString());
  
  // Keep only last 20 taps
  await client.ltrim(key, 0, 19);
  
  // Get all timestamps
  const timestamps = await client.lrange(key, 0, -1);
  return timestamps.map(ts => parseInt(ts, 10)).sort((a, b) => b - a); // Most recent first
}

/**
 * Calculate tap velocity and burst metrics from tap history
 */
export function calculateTapMetrics(tapTimestamps: number[], currentTimestamp: number): {
  tapVelocity: number; // Taps per second
  timeSinceLastTap: number;
  burstCount: number; // Taps in last 1 second
  maxBurst: number; // Max taps in any 1-second window
  isFrenzyMode: boolean; // >5 taps/sec sustained for 3+ seconds
} {
  if (tapTimestamps.length === 0) {
    return {
      tapVelocity: 0,
      timeSinceLastTap: 0,
      burstCount: 0,
      maxBurst: 0,
      isFrenzyMode: false,
    };
  }

  const timeSinceLastTap = currentTimestamp - tapTimestamps[0];
  
  // Count taps in last 1 second
  const oneSecondAgo = currentTimestamp - 1000;
  const burstCount = tapTimestamps.filter(ts => ts >= oneSecondAgo).length;
  
  // Calculate taps per second over last 3 seconds
  const threeSecondsAgo = currentTimestamp - 3000;
  const recentTaps = tapTimestamps.filter(ts => ts >= threeSecondsAgo);
  const tapVelocity = recentTaps.length > 0 
    ? recentTaps.length / ((currentTimestamp - recentTaps[recentTaps.length - 1]) / 1000)
    : 0;
  
  // Find max burst in any 1-second window
  let maxBurst = 0;
  for (let i = 0; i < tapTimestamps.length; i++) {
    const windowStart = tapTimestamps[i] - 1000;
    const windowTaps = tapTimestamps.filter(ts => ts >= windowStart && ts <= tapTimestamps[i]);
    maxBurst = Math.max(maxBurst, windowTaps.length);
  }
  
  // Frenzy mode: >5 taps/sec sustained for 3+ seconds
  const isFrenzyMode = tapVelocity > 5 && recentTaps.length >= 15;
  
  return {
    tapVelocity: Math.round(tapVelocity * 10) / 10, // Round to 1 decimal
    timeSinceLastTap,
    burstCount,
    maxBurst,
    isFrenzyMode,
  };
}

/**
 * Get user's previous disconnect time (for comeback detection)
 */
export async function getUserLastDisconnectTime(userId: string): Promise<number | null> {
  const user = await getUser(userId);
  return user?.lastDisconnectTime || null;
}

/**
 * Update user's disconnect time
 */
export async function updateUserDisconnectTime(userId: string, disconnectTime: number): Promise<void> {
  const client = getRedisClient();
  const user = await getUser(userId);
  if (user) {
    user.lastDisconnectTime = disconnectTime;
    await client.hset(REDIS_KEYS.USERS, userId, JSON.stringify(user));
    await client.hset(REDIS_KEYS.ALL_USERS, userId, JSON.stringify(user));
  }
}

/**
 * Increment user's reconnect count
 */
export async function incrementReconnectCount(userId: string): Promise<number> {
  const client = getRedisClient();
  const user = await getUser(userId);
  if (user) {
    user.reconnectCount = (user.reconnectCount || 0) + 1;
    await client.hset(REDIS_KEYS.USERS, userId, JSON.stringify(user));
    await client.hset(REDIS_KEYS.ALL_USERS, userId, JSON.stringify(user));
    return user.reconnectCount;
  }
  return 0;
}

/**
 * Track user's first tap time
 */
export async function trackFirstTap(userId: string, firstTapTime: number): Promise<void> {
  const client = getRedisClient();
  const user = await getUser(userId);
  if (user && !user.firstTapTime) {
    user.firstTapTime = firstTapTime;
    await client.hset(REDIS_KEYS.USERS, userId, JSON.stringify(user));
    await client.hset(REDIS_KEYS.ALL_USERS, userId, JSON.stringify(user));
  }
}

/**
 * Track user's previous tap count for improvement calculation
 */
export async function updatePreviousTapCount(userId: string, currentTapCount: number): Promise<number | null> {
  const client = getRedisClient();
  const user = await getUser(userId);
  if (user) {
    const previous = user.previousTapCount || user.tapCount;
    user.previousTapCount = currentTapCount;
    await client.hset(REDIS_KEYS.USERS, userId, JSON.stringify(user));
    await client.hset(REDIS_KEYS.ALL_USERS, userId, JSON.stringify(user));
    return previous;
  }
  return null;
}

/**
 * Track active sessions for multi-tab detection
 */
export async function incrementActiveSessions(userId: string): Promise<number> {
  const client = getRedisClient();
  const user = await getUser(userId);
  if (user) {
    user.activeSessions = (user.activeSessions || 0) + 1;
    await client.hset(REDIS_KEYS.USERS, userId, JSON.stringify(user));
    await client.hset(REDIS_KEYS.ALL_USERS, userId, JSON.stringify(user));
    return user.activeSessions;
  }
  return 0;
}

/**
 * Decrement active sessions
 */
export async function decrementActiveSessions(userId: string): Promise<number> {
  const client = getRedisClient();
  const user = await getUser(userId);
  if (user && user.activeSessions) {
    user.activeSessions = Math.max(0, user.activeSessions - 1);
    await client.hset(REDIS_KEYS.USERS, userId, JSON.stringify(user));
    await client.hset(REDIS_KEYS.ALL_USERS, userId, JSON.stringify(user));
    return user.activeSessions;
  }
  return 0;
}

/**
 * Track visit count and return visits
 */
export async function trackVisit(userId: string, visitTime: number): Promise<{ visitCount: number; isReturnVisit: boolean; lastVisitTime: number | null }> {
  const client = getRedisClient();
  const user = await getUser(userId);
  if (user) {
    const lastVisitTime = user.lastVisitTime || null;
    const isReturnVisit = lastVisitTime !== null;
    const visitCount = (user.visitCount || 0) + 1;
    
    // Calculate streak (consecutive days)
    let streakLength = user.streakLength || 0;
    if (lastVisitTime) {
      const lastVisitDate = new Date(lastVisitTime);
      const currentDate = new Date(visitTime);
      const daysDiff = Math.floor((currentDate.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        // Same day, keep streak
        streakLength = streakLength || 1;
      } else if (daysDiff === 1) {
        // Consecutive day, increment streak
        streakLength = (streakLength || 0) + 1;
      } else {
        // Streak broken, reset
        streakLength = 1;
      }
    } else {
      streakLength = 1;
    }
    
    user.visitCount = visitCount;
    user.lastVisitTime = visitTime;
    user.streakLength = streakLength;
    
    await client.hset(REDIS_KEYS.USERS, userId, JSON.stringify(user));
    await client.hset(REDIS_KEYS.ALL_USERS, userId, JSON.stringify(user));
    
    return { visitCount, isReturnVisit, lastVisitTime };
  }
  return { visitCount: 1, isReturnVisit: false, lastVisitTime: null };
}

/**
 * Calculate consistency score (lower variance = more consistent)
 * Returns a score from 0-100 where 100 is perfectly consistent
 */
export function calculateConsistencyScore(tapTimestamps: number[]): number {
  if (tapTimestamps.length < 5) return 50; // Not enough data
  
  // Calculate intervals between taps
  const intervals: number[] = [];
  for (let i = 1; i < tapTimestamps.length; i++) {
    intervals.push(tapTimestamps[i - 1] - tapTimestamps[i]);
  }
  
  if (intervals.length === 0) return 50;
  
  // Calculate mean
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  
  // Calculate variance
  const variance = intervals.reduce((sum, interval) => {
    return sum + Math.pow(interval - mean, 2);
  }, 0) / intervals.length;
  
  // Calculate coefficient of variation (CV)
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  
  // Convert to 0-100 score (lower CV = higher score)
  const score = Math.max(0, Math.min(100, 100 - (cv * 100)));
  
  return Math.round(score);
}

/**
 * Close Redis connection
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('Redis disconnected');
  }
}

