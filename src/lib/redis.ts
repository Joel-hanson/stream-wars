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
 * Close Redis connection
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('Redis disconnected');
  }
}

