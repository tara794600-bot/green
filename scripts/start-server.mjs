import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import handler from '../server/handler.mjs'
import { renderPage, sitemap } from '../server/render.mjs'

try {
  process.loadEnvFile('.env.local')
} catch (e) {
  if (e.code !== 'ENOENT') throw e
}
// npm start/preview는 빌드 검수·운영용입니다. 개발용 로컬 DB로 자동 전환되지 않습니다.
process.env.NODE_ENV = 'production'
const root = resolve('dist'),
  mime = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.json': 'application/json',
  }
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname.startsWith('/api/')) return handler(req, res)
  if (url.pathname === '/sitemap.xml') {
    try {
      return await sitemap(req, res)
    } catch {
      res.statusCode = 503
      return res.end('Service unavailable')
    }
  }
  try {
    const file = resolve(root, '.' + decodeURIComponent(url.pathname))
    // 정적 파일 조회가 dist 바깥으로 벗어나지 않게 합니다. 나머지 앱 경로는 SSR로 처리합니다.
    if (!file.startsWith(root + sep)) return renderPage(req, res)
    if ((await stat(file)).isFile()) {
      res.statusCode = 200
      res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
      res.setHeader(
        'Cache-Control',
        url.pathname.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'public,max-age=3600',
      )
      return res.end(await readFile(file))
    }
  } catch {
    /* application route */
  }
  return renderPage(req, res)
})
const port = Number(process.env.PORT || 4173)
server.listen(port, process.env.HOST || '127.0.0.1', () =>
  console.log(`Naran server: http://${process.env.HOST || '127.0.0.1'}:${port}`),
)
