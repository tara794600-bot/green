import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, unlink } from 'node:fs/promises'
import { randomBytes, randomUUID } from 'node:crypto'
import sharp from 'sharp'
import handler from '../api/handler.js'
import { hashPassword } from '../server/auth.mjs'

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
const rewrite = config.rewrites.find((rule) => rule.source === '/api/:path*')
const file = `.local/vercel-test-${randomUUID()}.json`
let server, base

before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.LOCAL_PREVIEW = 'true'
  process.env.LOCAL_DATA_FILE = file
  process.env.ADMIN_PASSWORD_HASH = hashPassword('Routing-Test-2026!')
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  server = createServer(async (req, res) => {
    // Vercel이 JSON을 미리 파싱한 경우와 Node 스트림 요청을 모두 검증합니다.
    if (req.headers['x-test-parsed-body']) {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    }
    return handler(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
  process.env.SITE_URL = base
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await unlink(file).catch(() => {})
})

// vercel.json의 rewrite 결과로 요청해 배포 환경의 경로 복원·쿼리 전달을 검증합니다.
function rewritten(path) {
  const url = new URL(path, base)
  const destination = new URL(rewrite.destination.replace(':path*', url.pathname.slice('/api/'.length)), base)
  for (const [name, value] of url.searchParams) destination.searchParams.append(name, value)
  return destination
}

test('Vercel API rewrite targets a concrete function and keeps the renderer separate', async () => {
  const destination = new URL(rewrite.destination, base)
  assert(!destination.pathname.includes('['))
  await readFile(new URL(`..${destination.pathname}.js`, import.meta.url))
  const renderRule = config.rewrites.find((rule) => rule.source === '/api/render')
  assert.equal(renderRule.destination, '/api/render')
  assert(config.rewrites.indexOf(renderRule) < config.rewrites.indexOf(rewrite))
  const response = await fetch(rewritten('/api/config'))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).passwordConfigured, true)
})

test('crawler files reach the dynamic renderer instead of static files', async () => {
  // Vercel은 정적 파일을 rewrite보다 먼저 제공하므로 public에 같은 이름의 파일이 있으면 안 됩니다.
  const render = config.rewrites.find((rule) => rule.destination.startsWith('/api/render?path='))
  const pattern = new RegExp('^' + render.source.slice(1) + '$')
  for (const path of ['robots.txt', 'rss.xml', 'llms.txt', 'naran-indexnow-key.txt', 'companies/a'])
    assert.match(path, pattern)
  for (const path of ['robots.txt', 'rss.xml', 'llms.txt'])
    await assert.rejects(readFile(new URL(`../public/${path}`, import.meta.url)))
  const sitemap = config.rewrites.find((rule) => rule.source === '/sitemap.xml')
  assert.equal(sitemap.destination, '/api/handler?__route=sitemap')
})

test('nested admin routes support login, session cookies, protected reads, and logout', async () => {
  let response = await fetch(rewritten('/api/admin/me'))
  assert.equal(response.status, 401)
  assert.match(response.headers.get('content-type'), /application\/json/)
  response = await fetch(rewritten('/api/admin/login'), {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'Routing-Test-2026!' }),
  })
  assert.equal(response.status, 200)
  const cookie = response.headers.get('set-cookie').split(';')[0]
  assert.equal((await response.json()).role, 'admin')
  for (const path of ['/api/admin/me', '/api/admin/rolling']) {
    response = await fetch(rewritten(path), { headers: { Cookie: cookie } })
    assert.equal(response.status, 200)
  }
  response = await fetch(rewritten('/api/admin/logout'), {
    method: 'POST',
    headers: { Origin: base, Cookie: cookie },
  })
  assert.equal(response.status, 200)
  response = await fetch(rewritten('/api/admin/me'), { headers: { Cookie: cookie } })
  assert.equal(response.status, 401)
})

test('rewrites preserve content query strings and original request URLs', async () => {
  const response = await fetch(rewritten('/api/content?path=/'))
  assert.equal(response.status, 200)
  assert((await response.json()).articles.length > 0)
  const direct = await fetch(base + '/api/admin/me')
  assert.equal(direct.status, 401)
  assert.match(direct.headers.get('content-type'), /application\/json/)
})

test('company image uploads retain their size allowance through Vercel rewrites', async (t) => {
  const login = await fetch(rewritten('/api/admin/login'), {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'Routing-Test-2026!' }),
  })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const image = await sharp(randomBytes(256 * 256 * 3), {
    raw: { width: 256, height: 256, channels: 3 },
  })
    .png()
    .toBuffer()
  const payload = JSON.stringify({ data: 'data:image/png;base64,' + image.toString('base64') })
  assert(Buffer.byteLength(payload) > 64000)
  const paths = [
    rewritten('/api/admin/upload'),
    rewritten('/api/admin/upload?source=company'),
    new URL('/api/admin/upload?__route=admin%2Fupload', base),
    new URL('/api/admin/upload/?source=company', base),
  ]
  for (const parsed of [false, true])
    for (const url of paths)
      await t.test(`${parsed ? 'parsed' : 'stream'} ${url.pathname}${url.search}`, async () => {
        const headers = {
          Origin: base,
          'Content-Type': 'application/json',
          Cookie: cookie,
          ...(parsed ? { 'x-test-parsed-body': 'true' } : {}),
        }
        const response = await fetch(url, { method: 'POST', headers, body: payload })
        const data = await response.json()
        assert.equal(response.status, 201, data.error)
        try {
          const uploaded = await fetch(base + data.url)
          assert.equal(uploaded.status, 200)
          assert.equal(uploaded.headers.get('content-type'), 'image/webp')
        } finally {
          const cleanup = await fetch(rewritten('/api/admin/media'), {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ url: data.url }),
          })
          assert.equal(cleanup.status, 200)
        }
      })
  await t.test('company saves retain a long Korean body and its image references', async () => {
    const headers = { Origin: base, 'Content-Type': 'application/json', Cookie: cookie }
    const document = {
      version: 2,
      html:
        `<p>${'가'.repeat(15000)}</p><p>${'나'.repeat(15000)}</p>` +
        '<figure data-type="image" data-align="center" data-size="full"><img src="/images/lawyer-seo.webp" alt="본문 이미지"><figcaption>본문 이미지</figcaption></figure>',
    }
    const payload = JSON.stringify({
      name: '업로드 검증 업체',
      service: '검증',
      description: '대표 이미지와 긴 본문 저장',
      image: '/images/lawyer-seo.webp',
      visibility: 'public',
      document,
    })
    assert(Buffer.byteLength(payload) > 64000)
    const response = await fetch(base + '/api/admin/companies/?source=company', {
      method: 'POST',
      headers,
      body: payload,
    })
    const company = await response.json()
    assert.equal(response.status, 201, company.error)
    try {
      const detail = await fetch(rewritten(`/api/companies/${company.id}`))
      assert.equal(detail.status, 200)
      const saved = await detail.json()
      assert.equal(saved.image, '/images/lawyer-seo.webp')
      assert.deepEqual(saved.document, document)
    } finally {
      const cleanup = await fetch(rewritten(`/api/admin/companies/${company.id}`), {
        method: 'DELETE',
        headers,
      })
      assert.equal(cleanup.status, 200)
    }
  })
  // 쿼리가 붙어도 실제 업로드 한도와 일반 API의 더 작은 한도는 유지합니다.
  for (const [url, data] of [
    [rewritten('/api/admin/upload?source=company'), { data: 'a'.repeat(4500000) }],
    [rewritten('/api/admin/media?source=company'), { url: 'a'.repeat(64000) }],
  ]) {
    const response = await fetch(url, {
      method: url.searchParams.get('__route') === 'admin/media' ? 'DELETE' : 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(data),
    })
    assert.equal(response.status, 413)
  }
})
