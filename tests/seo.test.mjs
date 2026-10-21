// 검색엔진·AI 크롤러용 메타정보, robots.txt, 사이트맵, RSS, llms.txt, IndexNow 알림을 검증합니다.
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { put } from '../server/store.mjs'
import {
  headTags,
  llmsTxt,
  notifySearchEngines,
  robotsTxt,
  rssXml,
  serveSeoFile,
  sitemapXml,
  structuredData,
} from '../server/seo.mjs'
import { pageMeta, ROBOTS_INDEX, ROBOTS_NOINDEX, ROBOTS_SEARCH } from '../shared/seo.mjs'
import seed from '../shared/content.json' with { type: 'json' }

const origin = 'https://naran.example'
const file = `.local/seo-test-${randomUUID()}.json`
const company = {
  id: 'seo-company',
  name: '검증코인',
  service: '코인 리딩방 사기',
  description: '리딩방 운영 방식과 입금 요구 내용을 정리했습니다.',
  image: '/api/media/12345678-1234-1234-1234-123456789012.webp',
  document: { version: 2, html: '<h2>상세 안내</h2><p>출금 지연 사례를 <strong>확인</strong>했습니다.</p>' },
  visibility: 'public',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-20T09:30:00.000Z',
}
const data = {
  articles: seed.articles,
  settings: seed.settings,
  companies: [company],
  selectedCompany: company,
}
function response() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    end(body) {
      this.body = String(body)
    },
  }
}
before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.LOCAL_PREVIEW = 'true'
  process.env.LOCAL_DATA_FILE = file
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  // 공개·검색차단·전화연결 업체를 각각 저장해 피드 포함 범위를 확인합니다.
  const record = ({ visibility, ...value }) => ({
    ...value,
    isPublic: visibility !== 'phone',
    isSearchBlocked: visibility === 'searchBlocked',
  })
  await put('companyCases', company.id, record(company))
  await put(
    'companyCases',
    'seo-hidden',
    record({
      ...company,
      id: 'seo-hidden',
      name: '검색차단업체',
      visibility: 'searchBlocked',
      updatedAt: '2026-10-21T00:00:00.000Z',
    }),
  )
  await put(
    'companyCases',
    'seo-phone',
    record({ ...company, id: 'seo-phone', name: '전화연결업체', visibility: 'phone' }),
  )
})
after(async () => {
  await unlink(file).catch(() => {})
})

test('company detail meta uses the company name, type, summary and canonical URL', () => {
  const meta = pageMeta('/companies/seo-company', '', data)
  assert.equal(meta.status, 200)
  assert.equal(meta.title, '검증코인 - 코인 리딩방 사기 정보 | 법무법인 나란')
  assert.equal(
    meta.description,
    '리딩방 운영 방식과 입금 요구 내용을 정리했습니다. 상세 안내 출금 지연 사례를 확인했습니다.',
  )
  assert.equal(meta.robots, ROBOTS_INDEX)
  assert.equal(meta.canonicalPath, '/companies/seo-company')
  assert.equal(meta.type, 'article')
  assert.deepEqual(
    meta.breadcrumbs.map((b) => b.name),
    ['홈', '업체 정보', '검증코인'],
  )
  const phone = pageMeta('/companies/seo-company', '', {
    ...data,
    selectedCompany: { ...company, visibility: 'phone' },
  })
  assert.equal(phone.title, '검증코인 전화 상담 안내 | 법무법인 나란')
  assert.match(phone.description, /전화 상담으로 안내.*1551-7202/)
})

test('missing, admin, ad landing and internal search pages are kept out of the index', () => {
  const missing = pageMeta('/companies/none', '', { ...data, selectedCompany: null })
  assert.equal(missing.status, 404)
  assert.equal(missing.robots, ROBOTS_NOINDEX)
  // 브라우저 내부 이동에서 아직 불러오지 않은 업체는 404로 단정하지 않습니다.
  assert.equal(pageMeta('/companies/none', '', { ...data, selectedCompany: undefined }).status, 200)
  assert.equal(pageMeta('/practice/case-01', '', data).status, 404)
  assert.equal(pageMeta('/admin/companies', '', data).robots, ROBOTS_NOINDEX)
  const landing = pageMeta('/p/token', '', {
    ...data,
    powerlinkPrefix: '/p/',
    landing: { keyword: '코인 변호사' },
  })
  assert.equal(landing.title, '코인 변호사 | 법무법인 나란')
  assert.equal(landing.robots, ROBOTS_NOINDEX)
  const search = pageMeta('/companies', 'q=%EC%BD%94%EC%9D%B8', data)
  assert.equal(search.robots, ROBOTS_SEARCH)
  assert.equal(search.canonicalPath, '')
  assert.equal(pageMeta('/companies', 'page=3', data).canonicalPath, '/companies?page=3')
  assert.equal(pageMeta('/', '', data).title, '법무법인 나란 | 금융사기 피해 상담')
  assert.equal(pageMeta('/cases/case-01', '', data).breadcrumbs[1].path, '/cases')
})

test('head tags include Open Graph, canonical, feeds, verification and escaped structured data', () => {
  process.env.NAVER_SITE_VERIFICATION = 'naver-token'
  process.env.GOOGLE_SITE_VERIFICATION = 'google-token'
  try {
    const risky = { ...company, name: '</script><script>alert(1)</script>' }
    const html = headTags(
      pageMeta('/companies/seo-company', '', { ...data, selectedCompany: risky }),
      data,
      origin,
    )
    assert.match(html, /<link rel="canonical" href="https:\/\/naran.example\/companies\/seo-company"\/>/)
    assert.match(html, /<meta property="og:url" content="https:\/\/naran.example\/companies\/seo-company"\/>/)
    assert.match(
      html,
      /<meta property="og:image" content="https:\/\/naran.example\/api\/media\/12345678-1234-1234-1234-123456789012.webp"\/>/,
    )
    assert.match(html, /<meta property="og:type" content="article"\/>/)
    assert.match(html, /<meta property="article:modified_time" content="2026-10-20T09:30:00.000Z"\/>/)
    assert.match(
      html,
      /<link rel="alternate" type="application\/rss\+xml"[^>]+href="https:\/\/naran.example\/rss.xml"\/>/,
    )
    assert.match(html, /<meta name="naver-site-verification" content="naver-token"\/>/)
    assert.match(html, /<meta name="google-site-verification" content="google-token"\/>/)
    assert.equal((html.match(/<script/g) || []).length, 1)
    assert.doesNotMatch(html, /<\/script><script>alert/)
  } finally {
    delete process.env.NAVER_SITE_VERIFICATION
    delete process.env.GOOGLE_SITE_VERIFICATION
  }
  const graph = structuredData(pageMeta('/companies/seo-company', '', data), data, origin)['@graph']
  assert.deepEqual(
    graph.map((node) => node['@type']),
    ['LegalService', 'BreadcrumbList', 'Article'],
  )
  const article = graph[2]
  assert.equal(article.headline, '검증코인 - 코인 리딩방 사기 정보')
  assert.equal(article.mainEntityOfPage, 'https://naran.example/companies/seo-company')
  assert.equal(article.dateModified, '2026-10-20T09:30:00.000Z')
  assert.equal(graph[0].telephone, '1551-7202')
  const faq = structuredData(pageMeta('/faq', '', data), data, origin)['@graph'].find(
    (n) => n['@type'] === 'FAQPage',
  )
  assert(faq.mainEntity.length > 0)
  // 색인하지 않는 페이지에는 구조화 데이터를 넣지 않습니다.
  assert.doesNotMatch(headTags(pageMeta('/missing', '', data), data, origin), /ld\+json/)
})

test('robots.txt allows search engines and OpenAI crawlers while protecting admin paths', () => {
  const robots = robotsTxt(origin)
  for (const agent of [
    'Googlebot',
    'Yeti',
    'Bingbot',
    'Daumoa',
    'OAI-SearchBot',
    'GPTBot',
    'ChatGPT-User',
    '*',
  ])
    assert.match(
      robots,
      new RegExp(
        `User-agent: ${agent.replace('*', '\\*')}\\nAllow: /api/media/\\nDisallow: /api/\\nDisallow: /admin\\nAllow: /\\n`,
      ),
    )
  assert.match(robots, /Sitemap: https:\/\/naran.example\/sitemap.xml/)
})

test('sitemap, RSS and llms.txt list detail pages with dates; phone-only companies stay out of feeds', async () => {
  const sitemap = await sitemapXml(origin)
  assert.match(
    sitemap,
    /<url><loc>https:\/\/naran.example\/companies\/seo-company<\/loc><lastmod>2026-10-20T09:30:00.000Z<\/lastmod><image:image><image:loc>https:\/\/naran.example\/api\/media\/[^<]+<\/image:loc><\/image:image><\/url>/,
  )
  assert(sitemap.includes('/companies/seo-hidden'))
  assert(sitemap.includes('/companies/seo-phone'))
  assert(sitemap.includes('<loc>https://naran.example/cases/case-01</loc><lastmod>'))
  const rss = await rssXml(origin, (doc) => doc.html + ']]>')
  assert.match(rss, /^<\?xml version="1.0" encoding="UTF-8"\?><rss version="2.0"/)
  assert.match(rss, /<atom:link href="https:\/\/naran.example\/rss.xml" rel="self"/)
  assert.match(
    rss,
    /<item><title>검증코인 - 코인 리딩방 사기 정보<\/title><link>https:\/\/naran.example\/companies\/seo-company<\/link><guid isPermaLink="true">https:\/\/naran.example\/companies\/seo-company<\/guid><pubDate>Tue, 20 Oct 2026 09:30:00 GMT<\/pubDate><category>코인 리딩방 사기<\/category>/,
  )
  assert.match(
    rss,
    /<img src="https:\/\/naran.example\/api\/media\/[^"]+" alt="검증코인 - 코인 리딩방 사기 정보"\/>/,
  )
  assert(rss.includes('<h2>상세 안내</h2>'))
  // 본문에 CDATA 종료 문자열이 있어도 XML이 깨지지 않습니다.
  assert(rss.includes(']]]]><![CDATA[>'))
  // 가장 최근에 바뀐 검색차단 업체가 먼저 나오고, 전화연결 업체는 제외합니다.
  assert(rss.indexOf('검색차단업체') < rss.indexOf('검증코인'))
  assert(!rss.includes('전화연결업체'))
  assert(rss.includes('<link>https://naran.example/guides/'))
  const llms = await llmsTxt(origin)
  assert.match(llms, /^# 법무법인 나란\n\n> /)
  assert.match(
    llms,
    /- \[검증코인 - 코인 리딩방 사기 정보\]\(https:\/\/naran.example\/companies\/seo-company\): .+ \(업데이트 2026-10-20\)/,
  )
  assert(!llms.includes('전화연결업체'))
  const res = response()
  assert.equal(await serveSeoFile({ headers: {} }, res, '/llms.txt'), true)
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
  assert.equal(await serveSeoFile({ headers: {} }, response(), '/about'), false)
})

test('IndexNow works without a configured key and notifies only from the public HTTPS site', async () => {
  const calls = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    return new Response(null, { status: 202 })
  }
  const env = { ...process.env }
  // 설정이 없으면 도메인에서 만든 고정 키를 씁니다. 같은 도메인이면 배포·서버가 달라도 같은 값입니다.
  const derived = createHash('sha256').update('naran-indexnow:naran.example').digest('hex').slice(0, 32)
  try {
    delete process.env.INDEXNOW_KEY
    process.env.SITE_URL = 'https://naran.example'
    await notifySearchEngines(['/companies/a'])
    assert.equal(calls.length, 0, '개발 서버에서는 보내지 않습니다')
    process.env.LOCAL_PREVIEW = 'false'
    process.env.NODE_ENV = 'production'
    await notifySearchEngines(['/companies/a', '/companies', '/companies'])
    assert.deepEqual(
      calls.map((c) => c.url),
      ['https://searchadvisor.naver.com/indexnow', 'https://api.indexnow.org/indexnow'],
    )
    assert.deepEqual(calls[0].body, {
      host: 'naran.example',
      key: derived,
      keyLocation: `https://naran.example/${derived}.txt`,
      urlList: ['https://naran.example/companies/a', 'https://naran.example/companies'],
    })
    let res = response()
    assert.equal(await serveSeoFile({ headers: {} }, res, `/${derived}.txt`), true)
    assert.equal(res.body, derived)
    assert.equal(await serveSeoFile({ headers: {} }, response(), '/other-key-value.txt'), false)
    // INDEXNOW_KEY는 직접 정한 키를 쓰고 싶을 때만 설정합니다. 형식이 틀리면 자동 키를 씁니다.
    process.env.INDEXNOW_KEY = 'naran-indexnow-key-2026'
    calls.length = 0
    await notifySearchEngines(['/companies/a'])
    assert.equal(calls[0].body.keyLocation, 'https://naran.example/naran-indexnow-key-2026.txt')
    res = response()
    assert.equal(await serveSeoFile({ headers: {} }, res, '/naran-indexnow-key-2026.txt'), true)
    assert.equal(res.body, 'naran-indexnow-key-2026')
    process.env.INDEXNOW_KEY = 'bad key!'
    calls.length = 0
    await notifySearchEngines(['/companies/a'])
    assert.equal(calls[0].body.key, derived)
    calls.length = 0
    process.env.SITE_URL = 'http://naran.example'
    await notifySearchEngines(['/companies/a'])
    assert.equal(calls.length, 0, 'HTTPS 운영 주소가 아니면 보내지 않습니다')
    process.env.SITE_URL = 'https://naran.example'
    // 검색엔진 응답이 실패해도 저장 흐름에는 오류를 던지지 않습니다.
    globalThis.fetch = async () => {
      throw new TypeError('network')
    }
    await notifySearchEngines(['/companies/a'])
  } finally {
    globalThis.fetch = realFetch
    process.env = env
  }
})
