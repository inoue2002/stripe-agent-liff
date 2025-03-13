import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // APIエンドポイントへのリクエストのみをチェック
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const referer = request.headers.get('referer');
    
    // Referrerが存在し、同じオリジンからのリクエストかチェック
    if (!referer || !referer.startsWith(request.nextUrl.origin)) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          message: 'Access denied - only frontend requests are allowed',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }

  return NextResponse.next();
}

// ミドルウェアを適用するパスを指定
export const config = {
  matcher: '/api/:path*',
};
