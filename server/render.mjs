import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { publicData, allCompanies } from './store.mjs'
import { requestPublicData } from './reference.mjs'

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
export async function renderPage(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost')
    const rewritten = url.pathname === '/api/render'
    const pathname = req.query?.path || (rewritten ? url.searchParams.get('path') : null) || url.pathname
    const search = new URLSearchParams(url.search)
    if (rewritten || req.query?.path) search.delete('path')
    const data = await requestPublicData(pathname)
    let template = await readFile(resolve('dist/index.html'), 'utf8')
    const admin = pathname === '/admin' || pathname.startsWith('/admin/')
    const names = {
      '/': '당신의 회복에, 법률로 나란히.',
      '/about': '나란 소개',
      '/practice': '업무 분야',
      '/cases': '사례 안내',
      '/companies': '사기업체 정보',
      '/guides': '소식·가이드',
      '/lawyers': '담당 변호사',
      '/faq': '자주 묻는 질문',
      '/contact': '오시는 길',
      '/privacy': '개인정보 처리 안내',
      '/consultation': '상담 신청',
    }
    const parts = pathname.split('/').filter(Boolean)
    const kinds = { practice: 'practice', cases: 'case', guides: 'guide', lawyers: 'lawyer' }
    const article =
      parts.length === 2 ? data.articles.find((a) => a.id === parts[1] && a.kind === kinds[parts[0]]) : null
    const valid = Boolean(names[pathname] || article || admin || data.selectedCompany || data.landing),
      title =
        (article?.title ||
          data.selectedCompany?.name ||
          data.landing?.keyword ||
          names[pathname] ||
          (admin ? '관리자' : '페이지를 찾을 수 없습니다.')) + ' | 법무법인 나란'
    template = template
      .replace(/<title>[^<]*<\/title>/, () => `<title>${escape(title)}</title>`)
      .replace(/(<meta property="og:title" content=")[^"]*/, (_, prefix) => prefix + escape(title))
    const description =
      article?.excerpt ||
      (data.selectedCompany?.visibility === 'phone'
        ? `${data.selectedCompany.name} 관련 전화 상담 안내`
        : data.selectedCompany?.description)
    if (description)
      template = template
        .replace(
          /(<meta name="description" content=")[^"]*/,
          (_, prefix) => prefix + escape(description.slice(0, 300)),
        )
        .replace(
          /(<meta property="og:description" content=")[^"]*/,
          (_, prefix) => prefix + escape(description.slice(0, 300)),
        )
    if (admin || data.landing || !valid)
      template = template.replace('content="index, follow"', 'content="noindex, nofollow"')
    if (!admin) {
      const { render } = await import(pathToFileURL(resolve('dist-server/entry-server.js')).href)
      template = template.replace(
        '<div id="root"></div>',
        () => `<div id="root">${render(pathname + (search.size ? '?' + search.toString() : ''), data)}</div>`,
      )
    }
    const bootstrap = JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
    template = template.replace(
      '</head>',
      () =>
        `<script id="naran-bootstrap" type="application/json">${bootstrap}</script>${process.env.SITE_URL ? `<link rel="canonical" href="${escape(new URL(pathname, process.env.SITE_URL).href)}"/>` : ''}</head>`,
    )
    res.statusCode = valid ? 200 : 404
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (admin) res.setHeader('X-Robots-Tag', 'noindex, nofollow')
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
export async function sitemap(req, res) {
  const { articles } = await publicData(),
    origin = process.env.SITE_URL || `http://${req.headers.host}`,
    paths = [
      '/',
      '/about',
      '/practice',
      '/cases',
      '/companies',
      '/guides',
      '/lawyers',
      '/consultation',
      '/faq',
      '/contact',
      '/privacy',
    ]
  const kinds = { practice: 'practice', case: 'cases', guide: 'guides', lawyer: 'lawyers' }
  for (const a of articles) if (kinds[a.kind]) paths.push(`/${kinds[a.kind]}/${a.id}`)
  for (const company of await allCompanies()) paths.push(`/companies/${company.id}`)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.end(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${escape(new URL(p, origin).href)}</loc></url>`).join('')}</urlset>`,
  )
}
