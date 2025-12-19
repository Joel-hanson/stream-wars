import { NextResponse } from 'next/server';

// Force dynamic rendering to ensure we get runtime environment variables
export const dynamic = 'force-dynamic';

/**
 * API route to get the WebSocket URL at runtime
 * This allows the WebSocket URL to be configured via environment variables
 * in Kubernetes without requiring a rebuild.
 * 
 * The NEXT_PUBLIC_WS_URL env var is set in the K8s ConfigMap and injected
 * into the container at runtime, so it's available here on the server side.
 */
export async function GET() {
  // Get WebSocket URL from environment variable
  // In K8s, this comes from the ConfigMap and is available at runtime
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
  
  return NextResponse.json({ wsUrl });
}

