import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export default async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const isFastSubdomain = hostname.startsWith('fast.');
  
  // For debugging
  console.log('Middleware running for path:', request.nextUrl.pathname, 'hostname:', hostname);
  
  // If this is the fast subdomain, allow unrestricted access
  if (isFastSubdomain) {
    // Rewrite to fast page for the root path
    if (request.nextUrl.pathname === '/') {
      return NextResponse.rewrite(new URL('/fast', request.url));
    }
    return NextResponse.next();
  }
  
  const session = await auth();
  
  // Check if this is a protected route on main domain
  const isProtectedRoute = 
    request.nextUrl.pathname === '/' || 
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/editor') ||
    request.nextUrl.pathname.startsWith('/projects');
  
  if (isProtectedRoute && !session) {
    console.log('Protected route detected, redirecting unauthenticated user to /try');
    return NextResponse.redirect(new URL('/try', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sign-in|sign-up|try|sam).*)'],
};
