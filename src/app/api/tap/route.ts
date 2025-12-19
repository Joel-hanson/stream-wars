import { getProducer, initializeKafka, TOPICS } from '@/lib/kafka';
import {
    publishAnalytics,
    publishFunAnomaly,
    publishPowerRanking,
} from '@/lib/kafka-producer-analytics';
import {
    calculateConsistencyScore,
    calculateTapMetrics,
    connectRedis,
    getSessionInfo,
    getUser,
    trackFirstTap,
    trackTapTimestamp,
    updatePreviousTapCount,
} from '@/lib/redis';
import { DeviceBrowserAnalytics, FunAnomalyEvent, PowerRankingEvent, TapEvent, Team, TeamDynamicsEvent } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Force dynamic rendering to prevent build-time evaluation
export const dynamic = 'force-dynamic';
initializeKafka().catch(console.error);
connectRedis().catch(console.error);

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

    const timestamp = Date.now();
    
    // Get user and session info for metrics
    const user = await getUser(userId);
    const sessionInfo = await getSessionInfo(sessionId);
    
    // Track tap timestamp for velocity calculation
    const tapTimestamps = await trackTapTimestamp(userId, timestamp);
    
    // Track first tap time (for first tap speed anomaly and team dynamics)
    if (user && !user.firstTapTime && user.sessionStartTime) {
      await trackFirstTap(userId, timestamp);
      const timeToFirstTap = timestamp - user.sessionStartTime;
      
      // Publish team dynamics: time to first tap
      const { publishTeamDynamics } = await import('@/lib/kafka-producer-analytics');
      const dynamics: TeamDynamicsEvent = {
        id: uuidv4(),
        userId,
        username,
        team: team as Team,
        timestamp,
        eventType: 'first_tap',
        metadata: {
          timeToFirstTap,
        },
      };
      publishTeamDynamics(dynamics).catch(err => console.error('Error publishing first tap dynamics:', err));
      
      // Publish first tap speed anomaly if very fast (< 500ms) or very slow (> 30s)
      if (timeToFirstTap < 500 || timeToFirstTap > 30000) {
        const anomaly: FunAnomalyEvent = {
          id: uuidv4(),
          userId,
          username,
          timestamp,
          anomalyType: 'first_tap_speed',
          metadata: {
            timeToFirstTap,
          },
        };
        publishFunAnomaly(anomaly).catch(err => console.error('Error publishing first tap anomaly:', err));
      }
    }
    
    // Bot suspicion detection: extremely consistent tap intervals (suspiciously perfect)
    if (tapTimestamps.length >= 20) {
      const intervals: number[] = [];
      for (let i = 1; i < Math.min(tapTimestamps.length, 20); i++) {
        intervals.push(tapTimestamps[i - 1] - tapTimestamps[i]);
      }
      
      if (intervals.length >= 10) {
        // Calculate coefficient of variation
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => {
          return sum + Math.pow(interval - mean, 2);
        }, 0) / intervals.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
        
        // Very low CV (< 0.05) suggests bot-like behavior
        if (cv < 0.05 && user && user.tapCount > 50) {
          const anomaly: FunAnomalyEvent = {
            id: uuidv4(),
            userId,
            username,
            timestamp,
            anomalyType: 'bot_suspicion',
            metadata: {
              consistencyScore: (1 - cv) * 100,
              tapCount: user.tapCount,
            },
          };
          publishFunAnomaly(anomaly).catch(err => console.error('Error publishing bot suspicion:', err));
        }
      }
    }
    
    // Calculate tap intensity metrics
    const tapMetrics = calculateTapMetrics(tapTimestamps, timestamp);
    
    // Calculate session duration
    const sessionDuration = sessionInfo 
      ? timestamp - sessionInfo.startTime 
      : undefined;
    
    // Track previous tap count for improvement calculation
    const previousTapCount = await updatePreviousTapCount(userId, (user?.tapCount || 0) + 1);
    
    // Calculate power rankings
    if (user && sessionDuration) {
      const powerRankingPromises: Promise<void>[] = [];
      
      // Most Improved: Acceleration in taps per minute
      if (previousTapCount !== null && previousTapCount > 0) {
        const previousVelocity = user.previousTapVelocity || 0;
        const currentVelocity = tapMetrics.tapVelocity;
        const improvement = currentVelocity - previousVelocity;
        
        if (improvement > 2) { // Significant acceleration
          const ranking: PowerRankingEvent = {
            id: uuidv4(),
            userId,
            username,
            team: team as Team,
            timestamp,
            rankingType: 'most_improved',
            value: improvement,
            metadata: {
              previousValue: previousVelocity,
              improvement,
            },
          };
          powerRankingPromises.push(publishPowerRanking(ranking));
        }
        
        // Update previous velocity
        if (user) {
          user.previousTapVelocity = currentVelocity;
        }
      }
      
      // Consistency King: Low variance in tap intervals
      if (tapTimestamps.length >= 10) {
        const consistencyScore = calculateConsistencyScore(tapTimestamps);
        if (consistencyScore > 80) { // Very consistent
          const ranking: PowerRankingEvent = {
            id: uuidv4(),
            userId,
            username,
            team: team as Team,
            timestamp,
            rankingType: 'consistency_king',
            value: consistencyScore,
          };
          powerRankingPromises.push(publishPowerRanking(ranking));
        }
      }
      
      // Sprint Champion: High burst count
      if (tapMetrics.burstCount >= 10) {
        const ranking: PowerRankingEvent = {
          id: uuidv4(),
          userId,
          username,
          team: team as Team,
          timestamp,
          rankingType: 'sprint_champion',
          value: tapMetrics.burstCount,
          metadata: {
            burstCount: tapMetrics.burstCount,
          },
        };
        powerRankingPromises.push(publishPowerRanking(ranking));
      }
      
      // Endurance Master: High tap count with long session
      if (sessionDuration > 10 * 60 * 1000 && (user.tapCount + 1) > 100) { // 10+ min, 100+ taps
        const tapsPerMinute = ((user.tapCount + 1) / sessionDuration) * 60 * 1000;
        const ranking: PowerRankingEvent = {
          id: uuidv4(),
          userId,
          username,
          team: team as Team,
          timestamp,
          rankingType: 'endurance_master',
          value: tapsPerMinute,
          metadata: {
            sessionDuration,
            tapCount: user.tapCount + 1,
          },
        };
        powerRankingPromises.push(publishPowerRanking(ranking));
      }
      
      // Fire and forget power rankings
      Promise.all(powerRankingPromises).catch(error => {
        console.error('Error publishing power rankings:', error);
      });
    }

    const tapEvent: TapEvent = {
      id: uuidv4(),
      userId,
      username,
      team: team as Team,
      timestamp,
      sessionId,
      // Tap intensity metrics
      tapVelocity: tapMetrics.tapVelocity,
      timeSinceLastTap: tapMetrics.timeSinceLastTap,
      burstCount: tapMetrics.burstCount,
      maxBurst: tapMetrics.maxBurst,
      isFrenzyMode: tapMetrics.isFrenzyMode,
      sessionDuration,
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

    // Publish device/browser analytics if user metadata is available
    if (user?.meta) {
      const analyticsPromises: Promise<void>[] = [];
      
      // Browser battle analytics
      if (user.meta.browser) {
        const browserAnalytics: DeviceBrowserAnalytics = {
          id: uuidv4(),
          timestamp,
          metricType: 'browser_battle',
          category: user.meta.browser,
          team: team as Team,
          score: user.tapCount + 1, // Current tap count after this tap
          tapCount: 1, // This tap
          activeUsers: 1, // This user
        };
        analyticsPromises.push(publishAnalytics(browserAnalytics));
      }
      
      // Device battle analytics
      if (user.meta.device) {
        const deviceAnalytics: DeviceBrowserAnalytics = {
          id: uuidv4(),
          timestamp,
          metricType: 'device_battle',
          category: user.meta.device,
          team: team as Team,
          score: user.tapCount + 1,
          tapCount: 1,
          activeUsers: 1,
        };
        analyticsPromises.push(publishAnalytics(deviceAnalytics));
      }
      
      // OS battle analytics
      if (user.meta.os) {
        const osAnalytics: DeviceBrowserAnalytics = {
          id: uuidv4(),
          timestamp,
          metricType: 'os_battle',
          category: user.meta.os,
          team: team as Team,
          score: user.tapCount + 1,
          tapCount: 1,
          activeUsers: 1,
        };
        analyticsPromises.push(publishAnalytics(osAnalytics));
      }
      
      // Fire and forget analytics (don't block tap response)
      Promise.all(analyticsPromises).catch(error => {
        console.error('Error publishing analytics:', error);
      });
    }

    return NextResponse.json({ success: true, tapEvent });
  } catch (error) {
    console.error('Error processing tap:', error);
    return NextResponse.json(
      { error: 'Failed to process tap' },
      { status: 500 }
    );
  }
}
