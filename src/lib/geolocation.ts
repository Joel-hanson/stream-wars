/**
 * Geolocation utility for IP address to location mapping
 * Uses a free API service for real-time lookups
 */

export interface GeoLocation {
  country?: string;
  city?: string;
  region?: string;
  countryCode?: string;
}

/**
 * Get geolocation from IP address
 * Uses ipapi.co free tier (1000 requests/day)
 * Falls back to a simple mapping for common IPs
 */
export async function getGeoLocation(ip?: string): Promise<GeoLocation> {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    // Local/private IP - return default
    return {
      country: 'Local',
      city: 'Development',
      region: 'Local Network',
    };
  }

  try {
    // Use ipapi.co free API (no API key required for basic usage)
    // Alternative: ip-api.com (free, 45 req/min)
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'StreamWars/1.0',
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      // Handle rate limiting or errors
      if (data.error) {
        console.warn(`GeoLocation API error for ${ip}:`, data.reason);
        return getFallbackLocation(ip);
      }

      return {
        country: data.country_name || data.country,
        city: data.city,
        region: data.region || data.region_code,
        countryCode: data.country_code,
      };
    } else {
      // Fallback if API fails
      return getFallbackLocation(ip);
    }
  } catch (error) {
    console.warn(`Failed to get geolocation for ${ip}:`, error);
    return getFallbackLocation(ip);
  }
}

/**
 * Fallback location mapping for common IP patterns
 * This is a simple fallback - in production you might want a more sophisticated approach
 */
function getFallbackLocation(ip: string): GeoLocation {
  // Simple fallback - you could enhance this with a local database
  return {
    country: 'Unknown',
    city: 'Unknown',
    region: 'Unknown',
  };
}

/**
 * Batch geolocation lookup (for efficiency)
 * Note: ipapi.co doesn't support batch, but we can rate limit ourselves
 */
export async function getGeoLocationsBatch(ips: string[]): Promise<Map<string, GeoLocation>> {
  const results = new Map<string, GeoLocation>();
  
  // Process with a small delay to respect rate limits
  for (const ip of ips) {
    const location = await getGeoLocation(ip);
    results.set(ip, location);
    
    // Small delay to avoid rate limiting (ipapi.co allows 1000/day)
    if (ips.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

