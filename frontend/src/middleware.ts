import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Supported languages
const SUPPORTED_LANGUAGES = ['zh', 'en'];
const DEFAULT_LANGUAGE = 'zh';

// Extract language code from path
function getLanguageFromPath(pathname: string): string | null {
  const parts = pathname.split('/');
  const lastPart = parts[parts.length - 1];
  return SUPPORTED_LANGUAGES.includes(lastPart) ? lastPart : null;
}

// Remove language suffix
function removeLanguageSuffix(pathname: string): string {
  const language = getLanguageFromPath(pathname);
  if (language) {
    const newPath = pathname.slice(0, -3); // Remove /{language}
    return newPath || '/';
  }
  return pathname;
}

// Add language suffix
function addLanguageSuffix(pathname: string, language: string): string {
  const cleanPath = removeLanguageSuffix(pathname);
  if (cleanPath === '/') {
    return `/${language}`;
  }
  return `${cleanPath}/${language}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip API routes, static files, and Next.js internal paths
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const currentLanguage = getLanguageFromPath(pathname);
  
  // If the path does not have a language suffix, redirect to default language
  if (!currentLanguage) {
    const newUrl = new URL(addLanguageSuffix(pathname, DEFAULT_LANGUAGE), request.url);
    console.log(`🌐 Redirect: ${pathname} → ${newUrl.pathname}`);
    return NextResponse.redirect(newUrl);
  }

  // If there is a language suffix, continue processing
  console.log(`🌍 Language route handling: ${pathname} (language: ${currentLanguage})`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - paths containing a dot (files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};