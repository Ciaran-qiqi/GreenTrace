import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 支持的语言
const SUPPORTED_LANGUAGES = ['zh', 'en'];
const DEFAULT_LANGUAGE = 'zh';

// 从路径中提取语言代码
function getLanguageFromPath(pathname: string): string | null {
  const parts = pathname.split('/');
  const lastPart = parts[parts.length - 1];
  return SUPPORTED_LANGUAGES.includes(lastPart) ? lastPart : null;
}

// 移除语言后缀
function removeLanguageSuffix(pathname: string): string {
  const language = getLanguageFromPath(pathname);
  if (language) {
    const newPath = pathname.slice(0, -3); // 移除 /{language}
    return newPath || '/';
  }
  return pathname;
}

// 添加语言后缀
function addLanguageSuffix(pathname: string, language: string): string {
  const cleanPath = removeLanguageSuffix(pathname);
  if (cleanPath === '/') {
    return `/${language}`;
  }
  return `${cleanPath}/${language}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 跳过API路由、静态文件和Next.js内部路径
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const currentLanguage = getLanguageFromPath(pathname);
  
  // 如果路径没有语言后缀，重定向到默认语言
  if (!currentLanguage) {
    const newUrl = new URL(addLanguageSuffix(pathname, DEFAULT_LANGUAGE), request.url);
    console.log(`🌐 重定向: ${pathname} → ${newUrl.pathname}`);
    return NextResponse.redirect(newUrl);
  }

  // 如果有语言后缀，继续处理
  console.log(`🌍 语言路由处理: ${pathname} (语言: ${currentLanguage})`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - 包含点的路径 (文件)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}; 