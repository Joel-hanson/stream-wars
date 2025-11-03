import { getProducer, TOPICS } from './kafka';
import { UserMetadataEvent } from './types';

/**
 * Sends user metadata event to Kafka
 * @param metadataEvent - The user metadata event to publish
 */
export async function publishUserMetadata(metadataEvent: UserMetadataEvent): Promise<void> {
  try {
    const producer = await getProducer();
    
    await producer.send({
      topic: TOPICS.USER_METADATA,
      messages: [
        {
          key: metadataEvent.userId,
          value: JSON.stringify(metadataEvent),
          timestamp: metadataEvent.timestamp.toString(),
        },
      ],
    });
    
    console.log(`Published user metadata for ${metadataEvent.username} (${metadataEvent.userId})`);
  } catch (error) {
    console.error('Error publishing user metadata:', error);
    throw error;
  }
}

/**
 * Parses user agent string to extract browser, OS, and device information
 * @param userAgent - The user agent string from the browser
 * @returns Parsed browser, OS, and device information
 */
export function parseUserAgent(userAgent: string): {
  browser?: string;
  os?: string;
  device?: string;
} {
  const parsed = {
    browser: undefined as string | undefined,
    os: undefined as string | undefined,
    device: undefined as string | undefined,
  };

  // Parse browser
  if (userAgent.includes('Chrome')) {
    const match = userAgent.match(/Chrome\/([\d.]+)/);
    parsed.browser = match ? `Chrome ${match[1]}` : 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/([\d.]+)/);
    parsed.browser = match ? `Firefox ${match[1]}` : 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/([\d.]+)/);
    parsed.browser = match ? `Safari ${match[1]}` : 'Safari';
  } else if (userAgent.includes('Edge')) {
    const match = userAgent.match(/Edg\/([\d.]+)/);
    parsed.browser = match ? `Edge ${match[1]}` : 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    const match = userAgent.match(/OPR\/([\d.]+)/);
    parsed.browser = match ? `Opera ${match[1]}` : 'Opera';
  }

  // Parse OS
  if (userAgent.includes('Windows NT')) {
    const match = userAgent.match(/Windows NT ([\d.]+)/);
    parsed.os = match ? `Windows ${match[1]}` : 'Windows';
  } else if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X ([\d_]+)/);
    parsed.os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (userAgent.includes('Linux')) {
    parsed.os = 'Linux';
  } else if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android ([\d.]+)/);
    parsed.os = match ? `Android ${match[1]}` : 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    const match = userAgent.match(/OS ([\d_]+)/);
    parsed.os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  }

  // Parse device type
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    parsed.device = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    parsed.device = 'Tablet';
  } else {
    parsed.device = 'Desktop';
  }

  return parsed;
}

