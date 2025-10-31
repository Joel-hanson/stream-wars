import { gameWebSocketServer } from '@/lib/websocket';
import { NextResponse } from 'next/server';

// Force dynamic rendering to prevent build-time evaluation
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const gameState = gameWebSocketServer.getGameState();
    const users = gameWebSocketServer.getUsers();
    const leaderboard = gameWebSocketServer.getLeaderboard();

    return NextResponse.json({
      gameState,
      users,
      leaderboard,
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game state' },
      { status: 500 }
    );
  }
}
