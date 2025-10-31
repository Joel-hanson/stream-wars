import { getWebSocketServer, initializeServer } from '@/lib/server';
import { NextRequest } from 'next/server';

// Force dynamic rendering to prevent build-time evaluation
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Initialize server components if not already done
    await initializeServer();
    
    const webSocketServer = getWebSocketServer();
    
    // This will be handled by the WebSocket server setup
    return new Response('WebSocket endpoint ready', { status: 200 });
  } catch (error) {
    console.error('WebSocket setup error:', error);
    return new Response('WebSocket setup failed', { status: 500 });
  }
}
