import { getProducer, initializeKafka, TOPICS } from '@/lib/kafka';
import { TapEvent } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Force dynamic rendering to prevent build-time evaluation
export const dynamic = 'force-dynamic';
initializeKafka().catch(console.error);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username, team, sessionId } = body;

    if (!userId || !username || !team || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const tapEvent: TapEvent = {
      id: uuidv4(),
      userId,
      username,
      team,
      timestamp: Date.now(),
      sessionId,
    };

    // Get producer at runtime, not at module load time
    const producer = await getProducer();

    // Send tap event to Kafka
    await producer.send({
      topic: TOPICS.GAME_TAPS,
      messages: [
        {
          key: userId,
          value: JSON.stringify(tapEvent),
          timestamp: tapEvent.timestamp.toString(),
        },
      ],
    });

    return NextResponse.json({ success: true, tapEvent });
  } catch (error) {
    console.error('Error processing tap:', error);
    return NextResponse.json(
      { error: 'Failed to process tap' },
      { status: 500 }
    );
  }
}
