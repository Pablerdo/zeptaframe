import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export default async function middleware(request: NextRequest) {
  const session = await auth();
  
  // For debugging
  console.log('Middleware running for path:', request.nextUrl.pathname);
  
  // Check if this is a protected route
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
