import handler from '../server/handler.mjs'

// Vercel rewrite의 내부 주소를 공통 API 핸들러가 이해하는 원래 경로로 복원합니다.
export default function vercelHandler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  // 원래 요청 경로 대신 함수 주소가 전달되면 __route 쿼리에서 API 경로를 복구합니다.
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
