import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') || 'image/png');
    // Ensure the browser and html2canvas treat it as friendly
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(blob, { status: 200, headers });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: 'Failed to fetch image proxy' }, { status: 500 });
  }
}
