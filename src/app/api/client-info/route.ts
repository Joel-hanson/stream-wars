import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const ip = (forwardedFor.split(',')[0] || request.ip || '').trim();
    const userAgent = request.headers.get('user-agent') || '';
    const cfIp = request.headers.get('cf-connecting-ip') || '';

    // Prefer Cloudflare IP, then x-forwarded-for, then request.ip
    const clientIp = (cfIp || ip) || undefined;

    return NextResponse.json({ ip: clientIp, userAgent });
  } catch (e) {
    return NextResponse.json({ ip: undefined, userAgent: '' });
  }
}


