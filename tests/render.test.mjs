import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { renderPage, sitemap } from '../server/render.mjs'
import { put } from '../server/store.mjs'
import { randomUUID, randomBytes, createCipheriv, createHash } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { testDocument } from './fixtures/company-document.mjs'

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
    await put('companyCases', company.id, { ...company, document: testDocument })
    html = await (await fetch(base + '/companies/' + company.id)).text()
    assert.match(html, /<h2>상세 안내<\/h2>/)
    assert.match(html, /class="doc-stat-value">128건<\/strong>/)
    assert.match(html, /<strong>HTML 안내<\/strong>/)
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
    assert.match(html, /다이어그램 원문/)
    await put('companyCases', company.id, { ...company, isSearchBlocked: true })
    html = await (await fetch(base + '/companies/' + company.id)).text()
    assert.match(html, /content="index, follow"/)
    assert.match(html, /<h1>서버검증업체<\/h1>/)
    const search = await (await fetch(base + '/companies?q=' + encodeURIComponent(company.name))).text()
    assert(!search.includes('class="company-card"'))
    await put('companyCases', company.id, { ...company, isPublic: false })
    html = await (await fetch(base + '/companies/' + company.id)).text()
    assert.match(html, /전화 상담으로 안내해 드립니다/)
    assert(!html.includes('class="company-document"'))
    assert((await (await fetch(base + '/sitemap.xml')).text()).includes('/companies/' + company.id))
    assert.equal((await fetch(base + '/companies/not-found')).status, 404)
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
