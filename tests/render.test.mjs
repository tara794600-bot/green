import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { renderPage, sitemap } from '../server/render.mjs'
import { put } from '../server/store.mjs'
import { randomUUID, randomBytes, createCipheriv, createHash } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { legacyDocument, testDocument } from './fixtures/company-document.mjs'

// 빌드된 SSR 번들을 사용합니다. npm run build 후 실행해 JS 실행 전 HTML·메타정보·404를 확인합니다.
let server, base
before(async () => {
  process.env.NODE_ENV = 'production'
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  process.env.SITE_URL = 'https://naran.example'
  server = createServer((req, res) => (req.url === '/sitemap.xml' ? sitemap(req, res) : renderPage(req, res)))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((resolve) => server.close(resolve))
})
test('detail has content and metadata before JavaScript execution', async () => {
  const response = await fetch(base + '/cases/case-01'),
    html = await response.text()
  assert.equal(response.status, 200)
  assert.match(html, /<h1>리딩방에서 안내받은 계좌로 투자금을 보낸 상황<\/h1>/)
  assert.match(html, /<h2>상담에서 확인할 쟁점<\/h2>/)
  assert.match(html, /rel="canonical" href="https:\/\/naran.example\/cases\/case-01"/)
  assert.match(html, /<script id="naran-bootstrap" type="application\/json">/)
  assert(!html.includes('ADMIN_PASSWORD_HASH'))
})
test('rewrite retains filtered queries in SSR HTML', async () => {
  const response = await fetch(base + '/api/render?path=/cases&q=' + encodeURIComponent('미술품'))
  const html = await response.text()
  assert.equal(response.status, 200)
  assert.match(html, /전체 <strong>1<\/strong>건/)
  assert.match(html, /value="미술품"/)
})
test('wrong detail kind returns a real 404 with rendered error content', async () => {
  const response = await fetch(base + '/practice/case-01'),
    html = await response.text()
  assert.equal(response.status, 404)
  assert.match(html, /<h1>찾으시는 페이지가 없습니다.<\/h1>/)
  assert.match(html, /noindex, nofollow/)
})
test('admin is noindex and sitemap lists only public routes', async () => {
  const response = await fetch(base + '/admin')
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow')
  const xml = await (await fetch(base + '/sitemap.xml')).text()
  assert.equal((xml.match(/<url>/g) || []).length, 38)
  assert(!xml.includes('/admin'))
  assert(xml.includes('/cases/case-15'))
})
test('crawler files are served from the render route with absolute site URLs', async () => {
  const robots = await fetch(base + '/robots.txt')
  assert.equal(robots.headers.get('content-type'), 'text/plain; charset=utf-8')
  const text = await robots.text()
  assert.match(
    text,
    /User-agent: OAI-SearchBot\nAllow: \/api\/media\/\nDisallow: \/api\/\nDisallow: \/admin\nAllow: \//,
  )
  assert.match(text, /User-agent: Yeti\n/)
  assert.match(text, /Sitemap: https:\/\/naran.example\/sitemap.xml/)
  const rss = await fetch(base + '/api/render?path=/rss.xml')
  assert.equal(rss.headers.get('content-type'), 'application/rss+xml; charset=utf-8')
  assert.match(
    await rss.text(),
    /<item><title>[^<]+<\/title><link>https:\/\/naran.example\/(?:cases|guides|practice|lawyers)\//,
  )
  assert.match(await (await fetch(base + '/llms.txt')).text(), /^# 법무법인 나란/)
  // INDEXNOW_KEY 설정 없이도 도메인에서 만든 키 파일을 제공합니다.
  const key = createHash('sha256').update('naran-indexnow:naran.example').digest('hex').slice(0, 32)
  assert.equal(await (await fetch(`${base}/${key}.txt`)).text(), key)
  const home = await (await fetch(base + '/')).text()
  assert.match(home, /<title>법무법인 나란 \| 금융사기 피해 상담<\/title>/)
  assert.match(home, /"@type":"WebSite"/)
})
test('company visibility is reflected in server HTML, search results, and sitemap', async () => {
  const file = `.local/render-test-${randomUUID()}.json`
  process.env.NODE_ENV = 'test'
  process.env.LOCAL_PREVIEW = 'true'
  process.env.LOCAL_DATA_FILE = file
  try {
    const company = {
      id: 'render-company',
      name: '서버검증업체',
      service: '검증 유형',
      description: '서버에서 렌더링한 상세 설명',
      image: '/images/lawyer-seo.webp',
      createdAt: new Date().toISOString(),
    }
    await put('companyCases', company.id, company)
    let html = await (await fetch(base + '/companies/' + company.id)).text()
    assert.match(html, /<h1>서버검증업체<\/h1>/)
    assert.match(html, /<p class="company-detail-description">서버에서 렌더링한 상세 설명<\/p>/)
    // 검색 결과에 쓰이는 제목·설명·대표 이미지가 업체마다 들어갑니다. 기본 설명 태그는 남지 않습니다.
    const head = html.slice(0, html.indexOf('</head>'))
    assert.match(head, /<title>서버검증업체 - 검증 유형 정보 \| 법무법인 나란<\/title>/)
    assert.match(head, /<meta name="description" content="서버에서 렌더링한 상세 설명"\/>/)
    assert.equal((head.match(/name="description"/g) || []).length, 1)
    assert.equal((head.match(/property="og:description"/g) || []).length, 1)
    assert.match(
      head,
      /<meta property="og:url" content="https:\/\/naran.example\/companies\/render-company"\/>/,
    )
    assert.match(
      head,
      /<meta property="og:image" content="https:\/\/naran.example\/images\/lawyer-seo.webp"\/>/,
    )
    assert.match(head, /<script type="application\/ld\+json" data-seo>.*"@type":"Article"/)
    assert.match(html, /<time datetime="\d{4}-\d{2}-\d{2}T[^"]+">\d{4}년 \d{1,2}월 \d{1,2}일<\/time>/i)
    await put('companyCases', company.id, { ...company, document: testDocument })
    html = await (await fetch(base + '/companies/' + company.id)).text()
    assert.match(html, /<h2>상세 안내<\/h2>/)
    assert.match(html, /<blockquote data-style="postit"><p><strong>HTML 안내<\/strong><\/p><\/blockquote>/)
    assert.match(html, /<mark data-color="#fff3a3" style="background-color:#fff3a3;color:inherit">/)
    assert.match(html, /<iframe src="https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ"/)
    assert.match(html, /href="https:\/\/fonts.googleapis.com\/css2\?family=Nanum\+Gothic/)
    // 원본 문서는 hydration용 JSON(문자 이스케이프)에도 들어가므로 렌더링된 본문 영역만 검사합니다.
    assert.doesNotMatch(
      html.slice(html.indexOf('company-rich-document')),
      /<script>alert\(1\)<\/script>|evil.example|onerror/,
    )
    // 이전 블록 형식 본문도 서버에서 HTML로 바꿔 표시합니다.
    await put('companyCases', company.id, { ...company, document: legacyDocument })
    html = await (await fetch(base + '/companies/' + company.id)).text()
    assert.match(html, /<h2>이전 안내<\/h2>/)
    assert.match(html, /<strong>128건<\/strong>/)
    assert.match(html, /<strong>이전 HTML 안내<\/strong>/)
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
    await put('companyCases', company.id, { ...company, isSearchBlocked: true })
    html = await (await fetch(base + '/companies/' + company.id)).text()
    assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large/)
    assert.match(html, /<h1>서버검증업체<\/h1>/)
    const search = await (await fetch(base + '/companies?q=' + encodeURIComponent(company.name))).text()
    assert(!search.includes('class="company-card"'))
    assert.match(search, /<meta name="robots" content="noindex, follow"\/>/)
    // 검색차단 업체는 피드·AI 안내에도 남고, 전화연결로 바꾸면 피드에서 빠집니다.
    assert((await (await fetch(base + '/rss.xml')).text()).includes('/companies/' + company.id))
    await put('companyCases', company.id, { ...company, isPublic: false })
    html = await (await fetch(base + '/companies/' + company.id)).text()
    assert.match(html, /전화 상담으로 안내해 드립니다/)
    assert(!html.includes('class="company-document"'))
    assert((await (await fetch(base + '/sitemap.xml')).text()).includes('/companies/' + company.id))
    assert(!(await (await fetch(base + '/rss.xml')).text()).includes('/companies/' + company.id))
    const missing = await fetch(base + '/companies/not-found')
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('x-robots-tag'), 'noindex, nofollow')
  } finally {
    process.env.NODE_ENV = 'production'
    process.env.LOCAL_PREVIEW = 'false'
    await unlink(file).catch(() => {})
  }
})
test('encrypted landing renders the home and keyword before client JavaScript', async () => {
  const secret = 'render-test-secret-only-without-real-credentials'
  process.env.POWERLINK_URL_SECRET = secret
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv)
  const encrypted = Buffer.concat([cipher.update('서버 검증 키워드', 'utf8'), cipher.final()])
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
  try {
    const response = await fetch(base + '/p/' + token),
      html = await response.text()
    assert.equal(response.status, 200)
    assert.match(html, /<p class="landing-keyword">서버 검증 키워드<\/p>/)
    assert.match(html, /content="noindex, nofollow"/)
    assert(!html.includes(secret))
    const invalid = await fetch(base + '/p/invalid-token')
    assert.equal(invalid.status, 404)
    assert.match(await invalid.text(), /광고 링크를 확인해 주세요/)
  } finally {
    delete process.env.POWERLINK_URL_SECRET
  }
})
