import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
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
  server = createServer(handler)
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
