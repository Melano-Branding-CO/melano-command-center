import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/favicon.ico', '/robots.txt', '/sitemap.xml']

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Melano Command Center", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  })
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false

  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return result === 0
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  const expectedUser = process.env.COMMAND_CENTER_USER
  const expectedPassword = process.env.COMMAND_CENTER_PASSWORD

  // Fail closed: never expose the command center when credentials are missing.
  if (!expectedUser || !expectedPassword) {
    return unauthorized()
  }

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Basic ')) {
    return unauthorized()
  }

  try {
    const decoded = atob(authorization.slice(6))
    const separator = decoded.indexOf(':')
    if (separator < 0) return unauthorized()

    const user = decoded.slice(0, separator)
    const password = decoded.slice(separator + 1)

    if (!safeEqual(user, expectedUser) || !safeEqual(password, expectedPassword)) {
      return unauthorized()
    }
  } catch {
    return unauthorized()
  }

  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
}
