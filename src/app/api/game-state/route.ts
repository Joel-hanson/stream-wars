import { connectRedis, getAllUsers, getGameState, getLeaderboard } from '@/lib/redis';
import { NextResponse } from 'next/server';

// Force dynamic rendering to prevent build-time evaluation
export const dynamic = 'force-dynamic';

// Connect to Redis when the API route is first loaded
connectRedis().catch(console.error);

export async function GET() {
  try {
    // Fetch game state directly from Redis
    const [gameState, users, leaderboard] = await Promise.all([
      getGameState(),
      getAllUsers(),
      getLeaderboard(),
    ]);

    return NextResponse.json({
      gameState,
      users,
      leaderboard
    });
  } catch (error) {
    console.error('Error fetching game state from Redis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game state' },
      { status: 500 }
    );
  }
}
