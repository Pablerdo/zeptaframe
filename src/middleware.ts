import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export default async function middleware(request: NextRequest) {
  const session = await auth();
  
  // For debugging
  // console.log('Middleware running for path:', request.nextUrl.pathname);
  
  // Check if this is a protected route (adjust paths as needed)
  const isProtectedRoute = 
    request.nextUrl.pathname === '/' || 
    request.nextUrl.pathname.startsWith('/dashboard');
  
  if (isProtectedRoute && !session) {
    // console.log('Protected route detected, checking for has_visited cookie');
    const hasVisited = request.cookies.get('has_visited');
    // console.log('Has visited cookie value:', hasVisited);
    
    if (!hasVisited) {
      //console.log('First visit detected, redirecting to /try');
      const response = NextResponse.redirect(new URL('/try', request.url));
      response.cookies.set('has_visited', 'true', { 
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
      return response;
    }
    
    // console.log('Return visitor without session, redirecting to sign-in');
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|try|sign-in).*)'],
};
