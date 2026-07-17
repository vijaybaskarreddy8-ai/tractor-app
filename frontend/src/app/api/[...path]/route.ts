import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleProxy(request, await params);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleProxy(request, await params);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleProxy(request, await params);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleProxy(request, await params);
}

async function handleProxy(
  request: NextRequest,
  { path }: { path: string[] }
) {
  const pathStr = path.join('/');

  // Exclude NextAuth and Locale API routes from proxy
  if (pathStr.startsWith('auth/callback') || pathStr.startsWith('auth/session') || pathStr.startsWith('auth/signin') || pathStr.startsWith('auth/signout') || path[0] === 'locale') {
    return NextResponse.json({ error: 'Route bypassed by proxy' }, { status: 404 });
  }

  // 1. Session Auth Check
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized: Please log in first' }, { status: 401 });
  }

  // 2. Build target URL
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${BACKEND_URL}/api/${pathStr}${searchParams ? `?${searchParams}` : ''}`;

  // 3. Forward request to Express backend
  try {
    const headers = new Headers();
    headers.set('X-API-Key', BACKEND_API_KEY);
    headers.set('X-User-Email', session.user.email);
    
    // Copy content-type if present
    const reqContentType = request.headers.get('content-type');
    if (reqContentType) {
      headers.set('content-type', reqContentType);
    }

    let body: any = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        body = await request.text();
      } catch {
        // empty body
      }
    }

    const backendRes = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    const resContentType = backendRes.headers.get('content-type') || '';
    let resData: any = null;

    if (resContentType.includes('application/json')) {
      resData = await backendRes.json();
    } else {
      resData = await backendRes.text();
    }

    if (resContentType.includes('application/json')) {
      return NextResponse.json(resData, { status: backendRes.status });
    } else {
      return new NextResponse(resData, {
        status: backendRes.status,
        headers: { 'content-type': resContentType },
      });
    }
  } catch (error) {
    console.error(`Proxy error for ${request.method} /api/${pathStr}:`, error);
    return NextResponse.json({ error: 'Gateway Connection Error' }, { status: 502 });
  }
}
