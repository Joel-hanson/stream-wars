import { getProducer, TOPICS } from './kafka';
import {
    ClientPerformanceEvent,
    DeviceBrowserAnalytics,
    EngagementPatternEvent,
    FunAnomalyEvent,
    PowerRankingEvent,
    SessionEvent,
    TeamDynamicsEvent,
} from './types';

/**
 * Publishes a session event to Kafka
 */
export async function publishSessionEvent(event: SessionEvent): Promise<void> {
  try {
    const producer = await getProducer();
    
    await producer.send({
      topic: TOPICS.SESSION_EVENTS,
      messages: [
        {
          key: event.userId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString(),
        },
      ],
    });
    
    console.log(`Published session event: ${event.eventType} for ${event.username} (${event.userId})`);
  } catch (error) {
    console.error('Error publishing session event:', error);
    throw error;
  }
}

/**
 * Publishes device/browser analytics to Kafka
 */
export async function publishAnalytics(analytics: DeviceBrowserAnalytics): Promise<void> {
  try {
    const producer = await getProducer();
    
    await producer.send({
      topic: TOPICS.ANALYTICS,
      messages: [
        {
          key: `${analytics.metricType}:${analytics.category}`,
          value: JSON.stringify(analytics),
          timestamp: analytics.timestamp.toString(),
        },
      ],
    });
    
    console.log(`Published analytics: ${analytics.metricType} - ${analytics.category} (${analytics.team})`);
  } catch (error) {
    console.error('Error publishing analytics:', error);
    throw error;
  }
}

/**
 * Publishes a power ranking event to Kafka
 */
export async function publishPowerRanking(event: PowerRankingEvent): Promise<void> {
  try {
    const producer = await getProducer();
    
    await producer.send({
      topic: TOPICS.POWER_RANKINGS,
      messages: [
        {
          key: event.userId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString(),
        },
      ],
    });
    
    console.log(`Published power ranking: ${event.rankingType} for ${event.username}`);
  } catch (error) {
    console.error('Error publishing power ranking:', error);
    throw error;
  }
}

/**
 * Publishes a team dynamics event to Kafka
 */
export async function publishTeamDynamics(event: TeamDynamicsEvent): Promise<void> {
  try {
    const producer = await getProducer();
    
    await producer.send({
      topic: TOPICS.TEAM_DYNAMICS,
      messages: [
        {
          key: event.userId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString(),
        },
      ],
    });
    
    console.log(`Published team dynamics: ${event.eventType} for ${event.username}`);
  } catch (error) {
    console.error('Error publishing team dynamics:', error);
    throw error;
  }
}

/**
 * Publishes a client performance event to Kafka
 */
export async function publishClientPerformance(event: ClientPerformanceEvent): Promise<void> {
  try {
    const producer = await getProducer();
    
    await producer.send({
      topic: TOPICS.CLIENT_PERFORMANCE,
      messages: [
        {
          key: event.userId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString(),
        },
      ],
    });
    
    console.log(`Published client performance for ${event.username}: ${event.connectionQuality}`);
  } catch (error) {
    console.error('Error publishing client performance:', error);
    throw error;
  }
}

/**
 * Publishes an engagement pattern event to Kafka
 */
export async function publishEngagementPattern(event: EngagementPatternEvent): Promise<void> {
  try {
    const producer = await getProducer();
    
    await producer.send({
      topic: TOPICS.ENGAGEMENT_PATTERNS,
      messages: [
        {
          key: event.userId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString(),
        },
      ],
    });
    
    console.log(`Published engagement pattern: ${event.patternType} for ${event.username}`);
  } catch (error) {
    console.error('Error publishing engagement pattern:', error);
    throw error;
  }
}

/**
 * Publishes a fun anomaly event to Kafka
 */
export async function publishFunAnomaly(event: FunAnomalyEvent): Promise<void> {
  try {
    const producer = await getProducer();
    
    await producer.send({
      topic: TOPICS.FUN_ANOMALIES,
      messages: [
        {
          key: event.userId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString(),
        },
      ],
    });
    
    console.log(`Published fun anomaly: ${event.anomalyType} for ${event.username}`);
  } catch (error) {
    console.error('Error publishing fun anomaly:', error);
    throw error;
  }
}

