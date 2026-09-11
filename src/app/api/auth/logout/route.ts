import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Berhasil logout' });
  
  response.cookies.set('smalledu_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('smalledu_role', '', {
    httpOnly: false,
    path: '/',
    maxAge: 0,
  });

  return response;
}
