import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const publicPaths = [
  '/login',
  '/language',
  '/api/auth',
  '/api/locale',
  '/_next',
  '/icons',
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.ico',
];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths through without any checks
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = req.auth;

  // No Google session → redirect to /login
  if (!session?.user) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Language check: if no locale cookie and not on /language, redirect there
  const localeCookie = req.cookies.get('locale');
  if (!localeCookie?.value && pathname !== '/language') {
    return NextResponse.redirect(new URL('/language', req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    '/((?!_next/static|_next/image).*)',
  ],
};
