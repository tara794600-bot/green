import { createHash } from 'node:crypto'
import { allCompanies, isLocal, publicData } from './store.mjs'
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
  SITE_NAME,
  articlePath,
  companyDescription,
  companyPath,
  companyTitle,
  sectionNames,
  summarize,
} from '../shared/seo.mjs'

// 검색엔진·AI 크롤러가 읽는 robots.txt, 사이트맵, RSS, llms.txt와 페이지 head 태그를 만듭니다.
// API 함수에서도 불러오므로 HTML 처리 라이브러리는 SSR 번들을 통해서만 사용합니다.
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
export const siteOrigin = (req) =>
  (process.env.SITE_URL || `http://${req?.headers?.host || 'localhost'}`).replace(/\/+$/, '')
const absolute = (url, origin) => new URL(url, origin + '/').href
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c')
const cdata = (value) => `<![CDATA[${String(value).replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
const rfc822 = (iso) => new Date(iso || Date.now()).toUTCString()
const newest = (items) =>
  items.map((v) => v.updatedAt || v.createdAt || '').sort((a, b) => b.localeCompare(a))

// 상세 내용이 있는 업체만 피드·AI 안내에 넣습니다. 전화연결 업체는 전화 안내만 표시하므로 제외합니다.
async function feedSources() {
  const [{ articles, settings }, companies] = await Promise.all([publicData(), allCompanies()])
  const listed = companies
    .filter((c) => c.visibility !== 'phone')
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
  const pages = articles.filter((a) => sectionNames[a.kind])
  return { articles, pages, settings, companies, listed }
}

export function headTags(meta, data, origin) {
  const settings = data.settings || {}
  const canonical = meta.canonicalPath ? absolute(meta.canonicalPath, origin) : ''
  const image = absolute(meta.image || DEFAULT_IMAGE, origin)
  const tag = (attr, key, content) => (content ? `<meta ${attr}="${key}" content="${escape(content)}"/>` : '')
  const verification = [
    ['google-site-verification', process.env.GOOGLE_SITE_VERIFICATION],
    ['naver-site-verification', process.env.NAVER_SITE_VERIFICATION],
    ['msvalidate.01', process.env.BING_SITE_VERIFICATION],
  ]
  return [
    `<title>${escape(meta.title)}</title>`,
    tag('name', 'description', meta.description),
    tag('name', 'robots', meta.robots),
    canonical && `<link rel="canonical" href="${escape(canonical)}"/>`,
    `<link rel="alternate" type="application/rss+xml" title="${escape(SITE_NAME)} 업체 정보" href="${escape(absolute('/rss.xml', origin))}"/>`,
    tag('property', 'og:type', meta.type),
    tag('property', 'og:site_name', settings.name || SITE_NAME),
    tag('property', 'og:locale', 'ko_KR'),
    tag('property', 'og:title', meta.title),
    tag('property', 'og:description', meta.description),
    tag('property', 'og:url', canonical),
    tag('property', 'og:image', image),
    tag('property', 'og:image:alt', meta.imageAlt),
    tag('property', 'article:published_time', meta.type === 'article' && meta.publishedAt),
    tag('property', 'article:modified_time', meta.type === 'article' && meta.modifiedAt),
    tag('property', 'article:section', meta.section),
    tag('name', 'twitter:card', 'summary_large_image'),
    tag('name', 'twitter:title', meta.title),
    tag('name', 'twitter:description', meta.description),
    tag('name', 'twitter:image', image),
    ...verification.map(([name, value]) => tag('name', name, value)),
    meta.status === 200 && meta.robots.startsWith('index')
      ? `<script type="application/ld+json" data-seo>${json(structuredData(meta, data, origin))}</script>`
      : '',
  ]
    .filter(Boolean)
    .join('')
}

// 구글·네이버가 페이지 성격을 이해하도록 schema.org 구조화 데이터를 만듭니다.
export function structuredData(meta, data, origin) {
  const settings = data.settings || {}
  const organizationId = absolute('/#organization', origin)
  const organization = {
    '@type': 'LegalService',
    '@id': organizationId,
    name: settings.name || SITE_NAME,
    url: absolute('/', origin),
    logo: absolute('/naran.svg', origin),
    image: absolute(DEFAULT_IMAGE, origin),
    description: DEFAULT_DESCRIPTION,
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.address
      ? { address: { '@type': 'PostalAddress', streetAddress: settings.address, addressCountry: 'KR' } }
      : {}),
    areaServed: 'KR',
  }
  const graph = [organization]
  const canonical = meta.canonicalPath ? absolute(meta.canonicalPath, origin) : ''
  if (meta.canonicalPath === '/')
    graph.push({
      '@type': 'WebSite',
      '@id': absolute('/#website', origin),
      url: absolute('/', origin),
      name: settings.name || SITE_NAME,
      inLanguage: 'ko-KR',
      publisher: { '@id': organizationId },
    })
  if (meta.breadcrumbs.length)
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: meta.breadcrumbs.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.name,
        item: absolute(crumb.path, origin),
      })),
    })
  if (meta.company || (meta.article && meta.type === 'article'))
    graph.push({
      '@type': 'Article',
      '@id': canonical + '#article',
      headline: meta.title.replace(/ \| [^|]+$/, '').slice(0, 110),
      description: meta.description,
      image: [absolute(meta.image, origin)],
      ...(meta.publishedAt ? { datePublished: meta.publishedAt } : {}),
      ...(meta.modifiedAt ? { dateModified: meta.modifiedAt } : {}),
      ...(meta.section ? { articleSection: meta.section } : {}),
      inLanguage: 'ko-KR',
      mainEntityOfPage: canonical,
      author: { '@id': organizationId },
      publisher: { '@id': organizationId },
      ...(meta.company ? { about: { '@type': 'Thing', name: meta.company.name } } : {}),
    })
  if (meta.article?.kind === 'lawyer')
    graph.push({
      '@type': 'Person',
      name: meta.article.title,
      description: meta.description,
      image: absolute(meta.image, origin),
      url: canonical,
      worksFor: { '@id': organizationId },
    })
  if (meta.canonicalPath === '/faq') {
    const faqs = (data.articles || []).filter((a) => a.kind === 'faq')
    if (faqs.length)
      graph.push({
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.title,
          acceptedAnswer: { '@type': 'Answer', text: faq.body || faq.excerpt },
        })),
      })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}

// 검색엔진과 AI 검색·수집 로봇을 명시적으로 허용합니다. 일부 해석기는 첫 규칙을 우선하므로 순서를 고정합니다.
export const crawlers = [
  'Googlebot',
  'Googlebot-Image',
  'Google-Extended',
  'Yeti',
  'Bingbot',
  'Daumoa',
  'OAI-SearchBot',
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Applebot',
  'Applebot-Extended',
  '*',
]
export function robotsTxt(origin) {
  const rules = ['Allow: /api/media/', 'Disallow: /api/', 'Disallow: /admin', 'Allow: /']
  return [
    `# ${SITE_NAME}`,
    '# 검색엔진(구글·네이버·빙·다음)과 AI 검색·수집 로봇(OpenAI·Anthropic·Perplexity 등)의 수집을 허용합니다.',
    '# 관리자 화면과 내부 API는 수집하지 않습니다.',
    '',
    ...crawlers.flatMap((agent) => [`User-agent: ${agent}`, ...rules, '']),
    `Sitemap: ${absolute('/sitemap.xml', origin)}`,
    '',
  ].join('\n')
}

export async function sitemapXml(origin) {
  const { articles, companies } = await feedSources()
  const url = (path, lastmod, image) =>
    `<url><loc>${escape(absolute(path, origin))}</loc>${lastmod ? `<lastmod>${escape(lastmod)}</lastmod>` : ''}${image ? `<image:image><image:loc>${escape(absolute(image, origin))}</image:loc></image:image>` : ''}</url>`
  const latest = newest([...articles, ...companies])[0] || ''
  const entries = [
    url('/', latest),
    ...[
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
    ].map((path) => url(path, path === '/companies' ? newest(companies)[0] : '')),
    ...articles.filter((a) => sectionNames[a.kind]).map((a) => url(articlePath(a), a.updatedAt, a.image)),
    // 업체의 검색차단은 내부 검색만 제한합니다. 직접 주소와 외부 검색 노출은 유지합니다.
    ...companies
      .slice()
      .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
      .map((c) => url(companyPath(c), c.updatedAt || c.createdAt, c.visibility === 'phone' ? '' : c.image)),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries.join('')}</urlset>`
}

// 본문 HTML 정제는 SSR 번들의 함수를 씁니다. 번들이 없으면 요약만 담아 피드를 계속 제공합니다.
async function documentRenderer() {
  try {
    const { documentHtml, sanitizeContent } = await import('../dist-server/entry-server.js')
    return (document) => sanitizeContent(documentHtml(document))
  } catch {
    return null
  }
}
export async function rssXml(origin, renderDocument) {
  const { listed, pages, settings } = await feedSources()
  const items = [
    ...listed.map((c) => ({
      title: companyTitle(c),
      path: companyPath(c),
      date: c.updatedAt || c.createdAt,
      category: c.service || '업체 정보',
      description: companyDescription(c, settings),
      image: c.image,
      document: c.document,
    })),
    ...pages.map((a) => ({
      title: a.title,
      path: articlePath(a),
      date: a.updatedAt,
      category: sectionNames[a.kind],
      description: summarize(a.excerpt || a.body),
      image: a.image,
    })),
  ]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 100)
  const render = renderDocument === undefined ? await documentRenderer() : renderDocument
  // 피드 안의 상대 주소는 다른 사이트에서 읽어도 열리도록 절대 주소로 바꿉니다.
  const absolutize = (html) => html.replace(/(src|href)="\//g, `$1="${origin}/`)
  const body = (item) =>
    [
      item.image && `<p><img src="${escape(absolute(item.image, origin))}" alt="${escape(item.title)}"/></p>`,
      `<p>${escape(item.description)}</p>`,
      render && item.document && absolutize(render(item.document)),
    ]
      .filter(Boolean)
      .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${escape(SITE_NAME)} 업체 정보·안내</title><link>${escape(absolute('/companies', origin))}</link><description>${escape(DEFAULT_DESCRIPTION)}</description><language>ko</language><lastBuildDate>${rfc822(items[0]?.date)}</lastBuildDate><atom:link href="${escape(absolute('/rss.xml', origin))}" rel="self" type="application/rss+xml"/><image><url>${escape(absolute(DEFAULT_IMAGE, origin))}</url><title>${escape(SITE_NAME)} 업체 정보·안내</title><link>${escape(absolute('/', origin))}</link></image>${items
    .map(
      (item) =>
        `<item><title>${escape(item.title)}</title><link>${escape(absolute(item.path, origin))}</link><guid isPermaLink="true">${escape(absolute(item.path, origin))}</guid><pubDate>${rfc822(item.date)}</pubDate><category>${escape(item.category)}</category><dc:creator>${escape(SITE_NAME)}</dc:creator><description>${escape(item.description)}</description><content:encoded>${cdata(body(item))}</content:encoded></item>`,
    )
    .join('')}</channel></rss>`
}

// AI 서비스가 사이트 구성과 상세페이지를 빠르게 파악하도록 llms.txt 형식(마크다운)으로 안내합니다.
export async function llmsTxt(origin) {
  const { listed, pages, settings } = await feedSources()
  const link = (title, path, note) =>
    `- [${title.replace(/[[\]]/g, '')}](${absolute(path, origin)})${note ? ': ' + note : ''}`
  return [
    `# ${settings.name || SITE_NAME}`,
    '',
    `> ${DEFAULT_DESCRIPTION}`,
    '',
    [
      settings.phone && `대표전화: ${settings.phone}`,
      settings.address && `주소: ${settings.address}`,
      settings.businessNumber && `사업자등록번호: ${settings.businessNumber}`,
    ]
      .filter(Boolean)
      .join(' · '),
    '',
    '업체 정보는 법무법인 나란이 상담 안내를 위해 정리한 자료입니다. 인용할 때는 각 상세페이지 주소와 최종 업데이트 날짜를 함께 밝혀 주세요.',
    '',
    '## 주요 페이지',
    link('업체 정보', '/companies', '등록된 업체 목록과 검색'),
    link('업무 분야', '/practice', '금융사기 유형별 업무 안내'),
    link('사례 안내', '/cases', '상담 사례'),
    link('소식·가이드', '/guides', '피해 대응과 상담 준비 가이드'),
    link('자주 묻는 질문', '/faq'),
    link('상담 신청', '/consultation'),
    link('오시는 길', '/contact'),
    '',
    '## 업체 정보',
    ...listed
      .slice(0, 300)
      .map((c) =>
        link(
          companyTitle(c),
          companyPath(c),
          summarize(companyDescription(c, settings), 120) +
            ` (업데이트 ${(c.updatedAt || c.createdAt).slice(0, 10)})`,
        ),
      ),
    '',
    '## 안내 글',
    ...pages.map((a) => link(a.title, articlePath(a), summarize(a.excerpt || a.body, 120))),
    '',
    '## 전체 목록',
    link('RSS 피드', '/rss.xml', '최근 등록·수정된 상세페이지 100건'),
    link('사이트맵', '/sitemap.xml', '모든 공개 페이지'),
    '',
  ].join('\n')
}

// IndexNow로 네이버·빙 등에 새 글·수정·삭제를 바로 알립니다. 구글은 사이트맵 lastmod로 확인합니다.
// 키는 검색엔진이 /{키}.txt로 확인하는 공개 값이라 비밀일 필요가 없습니다. INDEXNOW_KEY가 없으면
// 사이트 도메인에서 항상 같은 키를 만들어 별도 설정·저장 없이 동작합니다.
export function indexNowKey(origin = process.env.SITE_URL) {
  const custom = process.env.INDEXNOW_KEY || ''
  if (/^[a-zA-Z0-9-]{8,128}$/.test(custom)) return custom
  try {
    return createHash('sha256')
      .update(`naran-indexnow:${new URL(origin).host}`)
      .digest('hex')
      .slice(0, 32)
  } catch {
    return ''
  }
}
// 운영 HTTPS 주소에서만 알립니다. 개발 서버 주소는 검색엔진에 보내지 않습니다.
export const indexNowEnabled = () => /^https:\/\//.test(process.env.SITE_URL || '') && !isLocal()
export const indexNowEndpoints = [
  'https://searchadvisor.naver.com/indexnow',
  'https://api.indexnow.org/indexnow',
]
// 상세 주소와 그 상세가 걸린 목록 주소를 함께 알립니다.
export const articleUrls = (article) =>
  sectionNames[article.kind] ? [articlePath(article), articlePath(article).replace(/\/[^/]+$/, '')] : ['/faq']
export const companyUrls = (id) => [companyPath({ id }), '/companies']
// 저장을 막지 않도록 실패는 기록만 하고, 응답이 늦어도 3초 안에 끝냅니다.
export async function notifySearchEngines(paths) {
  if (!indexNowEnabled() || !paths.length) return
  const origin = new URL(process.env.SITE_URL)
  const key = indexNowKey(origin.origin)
  const body = JSON.stringify({
    host: origin.host,
    key,
    keyLocation: `${origin.origin}/${key}.txt`,
    urlList: [...new Set(paths.map((path) => absolute(path, origin.origin)))],
  })
  await Promise.all(
    indexNowEndpoints.map((endpoint) =>
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
        signal: AbortSignal.timeout(3000),
      })
        .then((response) => {
          if (!response.ok) console.warn('[indexnow]', new URL(endpoint).host, response.status)
        })
        .catch((e) => console.warn('[indexnow]', new URL(endpoint).host, e.name)),
    ),
  )
}

const files = {
  '/robots.txt': ['text/plain; charset=utf-8', (origin) => robotsTxt(origin)],
  '/sitemap.xml': ['application/xml; charset=utf-8', sitemapXml],
  '/rss.xml': ['application/rss+xml; charset=utf-8', (origin) => rssXml(origin)],
  '/llms.txt': ['text/plain; charset=utf-8', llmsTxt],
}
// SEO 파일 경로면 응답하고 true를 반환합니다. Vercel 렌더 함수·단독 서버·개발 서버가 같은 처리를 씁니다.
export async function serveSeoFile(req, res, pathname) {
  const key = indexNowKey(siteOrigin(req))
  const file =
    files[pathname] || (key && pathname === `/${key}.txt` ? ['text/plain; charset=utf-8', () => key] : null)
  if (!file) return false
  const [type, build] = file
  try {
    const body = await build(siteOrigin(req))
    res.statusCode = 200
    res.setHeader('Content-Type', type)
    // 크롤러 요청이 몰려도 저장소를 매번 읽지 않도록 CDN에서 5분간 재사용합니다.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end(body)
  } catch (e) {
    console.error('[seo]', pathname, e.name, e.code || 'seo_error')
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Retry-After', '300')
    res.end('Service unavailable')
  }
  return true
}
