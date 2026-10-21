import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { requestPublicData } from './reference.mjs'
import { headTags, serveSeoFile, siteOrigin } from './seo.mjs'
import { pageMeta } from '../shared/seo.mjs'

// index.html의 기본 제목·설명·robots·og 태그입니다. 여러 줄로 정렬된 태그도 지우도록 공백을 허용합니다.
const defaultHead =
  /<title>[\s\S]*?<\/title>\s*|<meta\s+(?:name|property)="(?:description|robots|og:[\w:]+)"[\s\S]*?\/>\s*/g

// Vercel 함수와 단독 Node 서버가 공유하는 HTML 응답 경로입니다.
// 공개 화면은 React SSR, 관리자 화면은 빈 루트에 브라우저 앱을 마운트합니다.
export async function renderPage(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost')
    const rewritten = url.pathname === '/api/render'
    const pathname = req.query?.path || (rewritten ? url.searchParams.get('path') : null) || url.pathname
    // robots.txt·RSS·llms.txt·IndexNow 키 파일은 HTML 대신 해당 형식으로 응답합니다.
    if (await serveSeoFile(req, res, pathname)) return
    // rewrite용 path만 제거하고 실제 검색·분류 쿼리는 SSR 라우터에 유지합니다.
    const search = new URLSearchParams(url.search)
    if (rewritten || req.query?.path) search.delete('path')
    const data = await requestPublicData(pathname)
    const meta = pageMeta(pathname, search.toString(), data)
    const admin = pathname === '/admin' || pathname.startsWith('/admin/')
    let template = (await readFile(resolve('dist/index.html'), 'utf8')).replace(defaultHead, '')
    if (!admin) {
      const { render } = await import('../dist-server/entry-server.js')
      template = template.replace(
        '<div id="root"></div>',
        () => `<div id="root">${render(pathname + (search.size ? '?' + search.toString() : ''), data)}</div>`,
      )
    }
    // script 요소에 JSON을 넣기 전 태그 종료 문자를 이스케이프합니다.
    // 브라우저는 이 데이터를 재사용해 서버 HTML과 동일한 첫 화면을 그립니다.
    const bootstrap = JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
    template = template.replace(
      '</head>',
      () =>
        `${headTags(meta, data, siteOrigin(req))}<script id="naran-bootstrap" type="application/json">${bootstrap}</script></head>`,
    )
    res.statusCode = meta.status
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (meta.robots.startsWith('noindex')) res.setHeader('X-Robots-Tag', meta.robots)
    res.end(template)
  } catch (e) {
    console.error('[render]', e.name, e.code || 'render_error')
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>법무법인 나란</title><body><h1>잠시 후 다시 방문해 주세요.</h1><p>서버에 연결할 수 없습니다. 상담 문의: <a href="tel:15517202">1551-7202</a></p></body></html>',
    )
  }
}
export const sitemap = (req, res) => serveSeoFile(req, res, '/sitemap.xml')
