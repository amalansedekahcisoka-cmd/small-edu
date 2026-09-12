import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface SessionData {
  id: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  exp: number;
}

function parseSession(cookieValue: string | undefined): SessionData | null {
  if (!cookieValue) return null;
  try {
    const jsonStr = Buffer.from(cookieValue, 'base64').toString('utf-8');
    const data: SessionData = JSON.parse(jsonStr);
    if (!data || !data.role || !data.exp) return null;
    if (Date.now() > data.exp) return null; // Expired
    return data;
  } catch (_) {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Hanya filter halaman dashboard yang diproteksi
  const isProtectedPath =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/teacher') ||
    pathname.startsWith('/student');

  if (!isProtectedPath) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('smalledu_session')?.value;
  const session = parseSession(sessionCookie);

  // 1. Jika belum login sama sekali, lempar ke halaman login
  if (!session) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('auth_required', '1');
    return NextResponse.redirect(loginUrl);
  }

  // 2. Proteksi Rute Admin
  if (pathname.startsWith('/admin')) {
    if (session.role !== 'admin') {
      const redirectUrl = new URL(
        session.role === 'teacher' ? '/teacher' : '/student',
        request.url
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 3. Proteksi Rute Teacher
  if (pathname.startsWith('/teacher')) {
    if (session.role !== 'teacher' && session.role !== 'admin') {
      const redirectUrl = new URL('/student', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 4. Proteksi Rute Student
  if (pathname.startsWith('/student')) {
    // Admin dan Guru boleh melihat tampilan siswa untuk evaluasi materi
    if (session.role !== 'student' && session.role !== 'teacher' && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
  ],
};
