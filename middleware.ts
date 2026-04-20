import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.has('sb-auth');
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  if (isPublic && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!isPublic && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
