import handler from '../server/handler.mjs'

export default function vercelHandler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  // Vercel can pass the rewritten function URL instead of the original request URL.
  if (url.pathname === '/api/handler') {
    const route = req.query?.__route ?? url.searchParams.get('__route')
    if (typeof route === 'string') {
      url.pathname = `/api/${route.replace(/^\/+/, '')}`
      url.searchParams.delete('__route')
      req.url = url.pathname + url.search
    }
  }
  return handler(req, res)
}
