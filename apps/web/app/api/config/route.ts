import { NextResponse } from 'next/server';

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const wsUrl = apiUrl.replace('http', 'ws');

  return NextResponse.json({
    apiUrl,
    wsUrl,
    widgetUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  });
}