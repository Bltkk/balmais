import { NextResponse } from 'next/server'

/**
 * GET /api/v1/health
 * 
 * Health check endpoint - no authentication required
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
}
