import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import handler from '../server/handler.mjs'
import { get, put, publicData } from '../server/store.mjs'
import { deliver, sheetRow, telegramText } from '../server/integrations.mjs'
import { hashPassword, verifyPassword } from '../server/auth.mjs'
import sharp from 'sharp'
import { legacyDocument, testDocument } from './fixtures/company-document.mjs'
import { MAX_DOCUMENT_HTML } from '../shared/company-document-schema.mjs'

// 인증·접수·외부 전송 상태를 실제 HTTP 핸들러로 검증합니다. 저장 파일은 개발 데이터와 분리합니다.
const file = resolve(`.local/server-test-${randomUUID()}.json`)
let server, base, cookie
before(async () => {
  process.env.LOCAL_PREVIEW = 'true'
  process.env.LOCAL_DATA_FILE = file
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  delete process.env.ADMIN_PASSWORD_HASH
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.GOOGLE_SHEET_ID
  delete process.env.POWERLINK_URL_SECRET
  delete process.env.POWERLINK_BASE_URL
  delete process.env.POWERLINK_PATH_PREFIX
  server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
  process.env.SITE_URL = base
})
after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await unlink(file).catch(() => {})
})
async function request(path, method = 'GET', data, authenticated = true, origin = base) {
  const response = await fetch(base + '/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { Origin: origin } : {}),
      ...(authenticated && cookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  })
  let result
  try {
    result = await response.json()
  } catch {
    result = null
  }
  return { response, data: result }
}
const consultation = (id = randomUUID()) => ({
  requestId: id,
  name: '검증용',
  phone: '010-0000-0000',
  category: '투자·리딩방 사기',
  details: '실제 접수가 아닌 서버 검증 데이터',
  consent: true,
  preferredTime: '오후',
  source: '/consultation',
})

test('password hashes do not store plaintext and reject the wrong password', () => {
  const hash = hashPassword('Test-Password-2026!')
  assert(!hash.includes('Test-Password'))
  assert(verifyPassword('Test-Password-2026!', hash))
  assert(!verifyPassword('wrong-password', hash))
  assert(!verifyPassword('any', 'invalid'))
})
test('admin data is inaccessible before login', async () => {
  const r = await request('/admin/consultations', 'GET', undefined, false)
  assert.equal(r.response.status, 401)
  for (const kind of ['rolling', 'companies', 'powerlinks']) {
    assert.equal((await request('/admin/' + kind, 'GET', undefined, false)).response.status, 401)
    assert.equal((await request('/admin/' + kind, 'POST', {}, false)).response.status, 401)
  }
})
test('same-origin validation blocks foreign mutation requests', async () => {
  const r = await request('/consultation', 'POST', consultation(), false, 'https://attacker.example')
  assert.equal(r.response.status, 403)
})
test('password-only setup creates an HttpOnly session and cannot be repeated', async () => {
  const r = await request('/admin/setup', 'POST', { password: 'Test-Password-2026!' }, false)
  assert.equal(r.response.status, 200)
  const raw = r.response.headers.get('set-cookie')
  assert(raw.includes('HttpOnly'))
  assert(raw.includes('SameSite=Strict'))
  cookie = raw.split(';')[0]
  assert.equal((await request('/admin/setup', 'POST', { password: 'Another-password' })).response.status, 409)
  assert.equal((await request('/admin/me')).data.role, 'admin')
})
test('consent and valid contact details are required by the server', async () => {
  const payload = consultation()
  assert.equal((await request('/consultation', 'POST', { ...payload, consent: false })).response.status, 400)
  assert.equal(
    (await request('/consultation', 'POST', { ...payload, phone: 'no-number' })).response.status,
    400,
  )
  assert.equal((await request('/consultation', 'POST', { ...payload, website: 'spam' })).response.status, 400)
})
let submitted
test('receipt is durable, idempotent, and explicitly local without credentials', async () => {
  const payload = consultation()
  submitted = payload.requestId
  const first = await request('/consultation', 'POST', payload)
  assert.equal(first.response.status, 201)
  assert.equal(first.data.localPreview, true)
  const repeated = await request('/consultation', 'POST', payload)
  assert.equal(repeated.response.status, 200)
  const changed = await request('/consultation', 'POST', { ...payload, name: '변경된이름' })
  assert.equal(changed.response.status, 409)
  const stored = await get('consultationRequests', submitted)
  assert.equal(stored.phone, '01000000000')
  assert.equal(stored.deliveries.telegram.status, 'unconfigured')
  assert.equal(stored.deliveries.sheets.status, 'unconfigured')
  assert(stored.consentAt)
})
test('admin status, assignee, and notes persist and cannot overwrite arbitrary fields', async () => {
  const r = await request(`/admin/consultations/${submitted}`, 'PATCH', {
    status: 'scheduled',
    assignee: '담당자',
    note: '상담 일정 확인',
  })
  assert.equal(r.response.status, 200)
  assert.equal(r.data.status, 'scheduled')
  assert.equal(r.data.notes[0].text, '상담 일정 확인')
  assert.equal(
    (await request(`/admin/consultations/${submitted}`, 'PATCH', { name: 'unauthorized-field' })).response
      .status,
    400,
  )
})
test('private and deleted content does not appear in public API', async () => {
  const seed = (await publicData(true)).articles[0]
  await request('/admin/content', 'PUT', { ...seed, published: false })
  assert(!(await publicData()).articles.some((a) => a.id === seed.id))
  assert((await publicData(true)).articles.some((a) => a.id === seed.id))
  await request(`/admin/content/${seed.id}`, 'DELETE')
  assert(!(await publicData(true)).articles.some((a) => a.id === seed.id))
})
test('invalid image URLs and fake images are rejected', async () => {
  const seed = (await publicData(true)).articles[0]
  assert.equal(
    (await request('/admin/content', 'PUT', { ...seed, image: 'javascript:alert(1)' })).response.status,
    400,
  )
  assert.equal(
    (await request('/admin/upload', 'POST', { data: 'data:image/png;base64,ZmFrZQ==' })).response.status,
    400,
  )
})
let companyId, linkToken
const companyPayload = {
  name: '검증코인 업체',
  service: '가상자산 유형',
  description: '실제 업체가 아닌 기능 검증 데이터',
  image: '/images/lawyer-seo.webp',
  visibility: 'public',
}
test('company CRUD and all three visibility settings match the reference site', async () => {
  const created = await request('/admin/companies', 'POST', companyPayload)
  assert.equal(created.response.status, 201)
  companyId = created.data.id
  assert((await request('/content')).data.companies.some((r) => r.id === companyId))
  for (const visibility of ['phone', 'searchBlocked']) {
    assert.equal(
      (await request(`/admin/companies/${companyId}`, 'PATCH', { visibility })).response.status,
      200,
    )
    assert(!(await request('/content')).data.companies.some((r) => r.id === companyId))
    const detail = await request(`/companies/${companyId}`)
    assert.equal(detail.response.status, 200)
    assert.equal(detail.data.visibility, visibility)
  }
  const updated = await request(`/admin/companies/${companyId}`, 'PUT', {
    ...companyPayload,
    description: '수정한 검증 설명',
  })
  assert.equal(updated.data.description, '수정한 검증 설명')
  assert.equal(updated.data.visibility, 'public')
  assert.equal(
    (await request(`/admin/companies/${companyId}`, 'PATCH', { visibility: 'invalid' })).response.status,
    400,
  )
  assert.equal(
    (await request('/admin/companies', 'POST', { ...companyPayload, image: 'javascript:alert(1)' })).response
      .status,
    400,
  )
})
test('rich company documents round-trip through the API, preserve legacy updates and validate limits', async () => {
  const result = await request(`/admin/companies/${companyId}`, 'PUT', {
    ...companyPayload,
    document: testDocument,
  })
  assert.equal(result.response.status, 200)
  assert.deepEqual((await request(`/companies/${companyId}`)).data.document, testDocument)
  await request(`/admin/companies/${companyId}`, 'PUT', companyPayload)
  assert.deepEqual((await request(`/companies/${companyId}`)).data.document, testDocument)
  // 이전 블록 형식으로 저장된 본문도 그대로 받아 유지합니다.
  await request(`/admin/companies/${companyId}`, 'PUT', { ...companyPayload, document: legacyDocument })
  assert.deepEqual((await request(`/companies/${companyId}`)).data.document, legacyDocument)
  for (const invalid of [
    { version: 2, html: '<figure data-type="image"><img src="blob:http://127.0.0.1/1"></figure>' },
    { version: 2, html: '한'.repeat(MAX_DOCUMENT_HTML + 1) },
    { ...legacyDocument, blocks: [...legacyDocument.blocks, legacyDocument.blocks[0]] },
  ])
    assert.equal(
      (await request(`/admin/companies/${companyId}`, 'PUT', { ...companyPayload, document: invalid }))
        .response.status,
      400,
    )
  const long = { version: 2, html: '<p>' + '한'.repeat(MAX_DOCUMENT_HTML - 7) + '</p>' }
  assert.equal(
    (await request(`/admin/companies/${companyId}`, 'PUT', { ...companyPayload, document: long })).response
      .status,
    200,
  )
  assert.equal((await request(`/companies/${companyId}`)).data.document.html.length, MAX_DOCUMENT_HTML)
  await request(`/admin/companies/${companyId}`, 'PUT', {
    ...companyPayload,
    document: { version: 2, html: '' },
  })
})

test('body uploads survive cover replacement and are deleted when their final document reference is removed', async () => {
  const image = await sharp({ create: { width: 3, height: 3, channels: 3, background: '#668844' } })
    .png()
    .toBuffer()
  const upload = await request('/admin/upload', 'POST', {
    data: 'data:image/png;base64,' + image.toString('base64'),
  })
  const url = upload.data.url
  const doc = { version: 2, html: `<figure data-type="image"><img src="${url}"></figure>` }
  await request(`/admin/companies/${companyId}`, 'PUT', { ...companyPayload, image: url, document: doc })
  await request(`/admin/companies/${companyId}`, 'PUT', { ...companyPayload, document: doc })
  assert.equal((await fetch(base + url)).status, 200)
  await request(`/admin/companies/${companyId}`, 'PUT', {
    ...companyPayload,
    document: { version: 2, html: '<p>사진을 뺀 본문</p>' },
  })
  assert.equal((await fetch(base + url)).status, 404)
})

test('admin search finds legacy document IDs across all paginated records', async () => {
  await Promise.all(
    Array.from({ length: 31 }, (_, i) =>
      put('companyCases', `legacy-${i}`, {
        ...companyPayload,
        name: `과거업체 ${i}`,
        createdAt: `2025-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      }),
    ),
  )
  const page = await request('/admin/companies?page=2')
  assert.equal(page.data.total, 32)
  assert.equal(page.data.items.length, 2)
  const search = await request('/admin/companies?q=' + encodeURIComponent('과거업체 0'))
  assert.equal(search.data.filtered, 1)
  assert.equal(search.data.items[0].id, 'legacy-0')
  assert.equal((await request('/admin/companies?page=999')).data.page, 2)
})
test('rolling image uploads are displayed and shared image cleanup preserves live references', async () => {
  const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#809c60' } })
    .png()
    .toBuffer()
  const upload = await request('/admin/upload', 'POST', {
    data: 'data:image/png;base64,' + image.toString('base64'),
  })
  assert.equal(upload.response.status, 201)
  const payload = { category: '검증', title: '검증 사건', result: '가상 결과', image: upload.data.url }
  const first = await request('/admin/rolling', 'POST', payload)
  const second = await request('/admin/rolling', 'POST', payload)
  assert.equal(first.response.status, 201)
  assert((await request('/content')).data.rollingCases.some((r) => r.id === first.data.id))
  const edit = await request(`/admin/rolling/${second.data.id}`, 'PUT', { ...payload, title: '수정 사건' })
  assert.equal(edit.data.title, '수정 사건')
  await request(`/admin/rolling/${first.data.id}`, 'DELETE')
  assert.equal((await fetch(base + upload.data.url)).status, 200)
  await request(`/admin/rolling/${second.data.id}`, 'DELETE')
  assert.equal((await fetch(base + upload.data.url)).status, 404)
})
test('encrypted powerlinks resolve keywords, reject tampering, and preserve distributed URLs after list deletion', async () => {
  const created = await request('/admin/powerlinks', 'POST', { keyword: '검증코인 변호사' })
  assert.equal(created.response.status, 201)
  linkToken = created.data.token
  assert(!created.data.url.includes(encodeURIComponent('검증코인')))
  assert.equal(created.data.url, base + '/p/' + linkToken)
  const landing = await request('/landing/' + linkToken)
  assert.equal(landing.data.keyword, '검증코인 변호사')
  assert(landing.data.companies.some((r) => r.id === companyId))
  const invalid = (linkToken[0] === 'a' ? 'b' : 'a') + linkToken.slice(1)
  assert.equal((await request('/landing/' + invalid)).response.status, 404)
  await request(`/admin/powerlinks/${created.data.id}`, 'DELETE')
  assert.equal((await request('/admin/powerlinks')).data.total, 0)
  assert.equal((await request('/landing/' + linkToken)).response.status, 200)
})
test('ad attribution survives navigation and is included in notifications and sheet fields', async () => {
  const payload = {
    ...consultation(),
    landingPath: '/p/' + linkToken,
    queryString: '?utm_source=naver',
    referrer: 'https://search.naver.com/search.naver',
  }
  const result = await request('/consultation', 'POST', payload)
  assert.equal(result.response.status, 201)
  const stored = await get('consultationRequests', payload.requestId)
  assert.equal(stored.keyword, '검증코인 변호사')
  assert.equal(stored.visitSource, '네이버 파워링크')
  assert.equal(sheetRow(stored)[12], stored.keyword)
  assert.match(telegramText(stored), /검증코인 변호사/)
  assert.equal((await request('/consultation', 'POST', payload)).response.status, 200)
})
test('company deletion removes public details and production link generation requires a secret', async () => {
  await request(`/admin/companies/${companyId}`, 'DELETE')
  assert.equal((await request(`/companies/${companyId}`)).response.status, 404)
  const { decryptKeyword } = await import('../server/reference.mjs')
  process.env.LOCAL_PREVIEW = 'false'
  delete process.env.POWERLINK_URL_SECRET
  assert.equal(await decryptKeyword(linkToken), '')
  process.env.LOCAL_PREVIEW = 'true'
})
test('independent delivery failure preserves receipt and retries only the failed channel', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'unit-test-only'
  process.env.TELEGRAM_CHAT_ID = 'unit-test-only'
  process.env.GOOGLE_SHEET_ID = 'unit-test-only'
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{}'
  let telegramCalls = 0,
    sheetCalls = 0
  const adapters = {
    telegram: async () => {
      telegramCalls++
      throw new Error('offline')
    },
    sheets: async () => {
      sheetCalls++
      return {}
    },
  }
  let result = await deliver(submitted, undefined, adapters)
  assert.equal(result.telegram.status, 'failed')
  assert.equal(result.sheets.status, 'sent')
  await deliver(submitted, undefined, {
    ...adapters,
    telegram: async () => {
      telegramCalls++
      return { messageId: 1 }
    },
  })
  result = (await get('consultationRequests', submitted)).deliveries
  assert.equal(result.telegram.status, 'sent')
  assert.equal(sheetCalls, 1)
  assert.equal(telegramCalls, 2)
})
test('concurrent delivery retries acquire only one lease', async () => {
  const old = await get('consultationRequests', submitted)
  await put('consultationRequests', submitted, {
    ...old,
    deliveries: { ...old.deliveries, telegram: { status: 'failed', attempts: 0 } },
  })
  let calls = 0
  const adapters = {
    telegram: async () => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 40))
      return {}
    },
    sheets: async () => ({}),
  }
  await Promise.all([deliver(submitted, ['telegram'], adapters), deliver(submitted, ['telegram'], adapters)])
  assert.equal(calls, 1)
})
test('sheet rows preserve phone strings and notification size stays bounded', async () => {
  const row = await get('consultationRequests', submitted)
  assert.equal(sheetRow(row)[3], '01000000000')
  assert(telegramText({ ...row, details: '한'.repeat(4000) }).length < 4096)
})
test('logout revokes the session server-side', async () => {
  assert.equal((await request('/admin/logout', 'POST', {})).response.status, 200)
  assert.equal((await request('/admin/consultations')).response.status, 401)
})
test('production without credentials fails closed instead of local success', async () => {
  process.env.LOCAL_PREVIEW = 'false'
  const r = await request('/consultation', 'POST', consultation(), false)
  assert.equal(r.response.status, 503)
  process.env.LOCAL_PREVIEW = 'true'
})
