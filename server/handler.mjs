import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  get,
  list,
  put,
  mutate,
  publicData,
  rateLimit,
  audit,
  isLocal,
  firebaseConfigured,
} from './store.mjs'
import { checkOrigin, clientIp, login, logout, passwordConfigured, requireAdmin } from './auth.mjs'
import {
  consultationSchema,
  articleSchema,
  settingsSchema,
  updateSchema,
  parse,
  HttpError,
} from './validation.mjs'
import { deliver, integrationConfig } from './integrations.mjs'
import { serveLocalMedia, uploadImage, deleteUnusedImage } from './media.mjs'
import { sitemap } from './render.mjs'
import { attribution, companyDetail, landingData, referenceAdmin, requestPublicData } from './reference.mjs'

async function body(req) {
  const max = req.url?.endsWith('/upload')
    ? 4500000
    : /^\/api\/admin\/companies(?:\/[^/?]+)?(?:\?|$)/.test(req.url || '')
      ? 800000
      : 64000
  if (req.body) {
    if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) > max)
      throw new HttpError(413, '요청이 너무 큽니다.')
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body)
      } catch {
        throw new HttpError(400, 'JSON 형식을 확인해 주세요.')
      }
    }
    return req.body
  }
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > max) throw new HttpError(413, '요청이 너무 큽니다.')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw new HttpError(400, 'JSON 형식을 확인해 주세요.')
  }
}
function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const url = new URL(req.url, 'http://localhost'),
      path = url.pathname.replace(/\/$/, '')
    const method = req.method
    if (!['GET', 'POST', 'PATCH', 'DELETE', 'PUT'].includes(method))
      throw new HttpError(405, '지원하지 않는 요청입니다.')
    if (method !== 'GET') checkOrigin(req)
    if ((path === '/api/sitemap' || path === '/sitemap.xml') && method === 'GET')
      return await sitemap(req, res)
    if (path.startsWith('/api/media/') && method === 'GET')
      return await serveLocalMedia(path.split('/').pop(), res)
    if (path === '/api/config' && method === 'GET')
      return json(res, 200, {
        localPreview: isLocal() && !firebaseConfigured(),
        firebaseConfigured: firebaseConfigured(),
        passwordConfigured:
          isLocal() || firebaseConfigured()
            ? await passwordConfigured()
            : Boolean(process.env.ADMIN_PASSWORD_HASH),
        integrations: integrationConfig(),
      })
    if (path === '/api/content' && method === 'GET')
      return json(res, 200, await requestPublicData(url.searchParams.get('path') || '/'))
    if (path.startsWith('/api/companies/') && method === 'GET') {
      const value = await companyDetail(path.slice('/api/companies/'.length))
      if (!value) throw new HttpError(404, '등록된 업체 정보를 찾을 수 없습니다.')
      return json(res, 200, value)
    }
    if (path.startsWith('/api/landing/') && method === 'GET') {
      const value = await landingData(path.slice('/api/landing/'.length))
      if (!value) throw new HttpError(404, '유효한 광고 링크가 아닙니다.')
      return json(res, 200, value)
    }
    if (path === '/api/consultation' && method === 'POST') {
      const payload = parse(consultationSchema, await body(req)),
        { requestId, ...fields } = payload
      delete fields.consent
      delete fields.website
      const hash = createHash('sha256').update(JSON.stringify(fields)).digest('hex')
      const existing = await get('consultationRequests', requestId)
      if (existing) {
        if (existing.requestHash !== hash)
          throw new HttpError(409, '접수 내용이 변경되었습니다. 페이지를 새로고침한 후 다시 신청해 주세요.')
        return json(res, 200, { id: requestId, localPreview: isLocal() && !firebaseConfigured() })
      }
      await rateLimit('submit:' + clientIp(req), 5, 15 * 60 * 1000)
      const tracking = await attribution(fields)
      const now = new Date().toISOString()
      const delivery = { status: 'pending', attempts: 0 }
      await mutate('consultationRequests', requestId, (old) => {
        if (old) {
          if (old.requestHash !== hash) throw new HttpError(409, '동일 접수번호의 내용이 다릅니다.')
          return old
        }
        return {
          id: requestId,
          ...fields,
          ...tracking,
          requestHash: hash,
          consentAt: now,
          consentVersion: '2026-09-28',
          createdAt: now,
          updatedAt: now,
          status: 'new',
          priority: 'normal',
          assignee: '',
          notes: [],
          deliveries: { telegram: { ...delivery }, sheets: { ...delivery } },
        }
      })
      try {
        await deliver(requestId)
      } catch {
        console.error('[consultation] delivery state update failed; request preserved:', requestId)
      }
      return json(res, 201, { id: requestId, localPreview: isLocal() && !firebaseConfigured() })
    }
    if (['/api/admin/login', '/api/admin/setup'].includes(path) && method === 'POST') {
      const data = await body(req)
      return json(res, 200, await login(req, res, data.password, path.endsWith('setup')))
    }
    if (path === '/api/admin/logout' && method === 'POST') {
      await logout(req, res)
      return json(res, 200, { ok: true })
    }
    if (!path.startsWith('/api/admin/')) throw new HttpError(404, '요청한 경로를 찾을 수 없습니다.')
    const identity = await requireAdmin(req)
    const referenceResult = await referenceAdmin(path, method, url, () => body(req), req)
    if (referenceResult) return json(res, method === 'POST' ? 201 : 200, referenceResult)
    if (path === '/api/admin/media' && method === 'DELETE') {
      const data = parse(z.object({ url: z.string().max(1500) }).strict(), await body(req))
      return json(res, 200, { warning: await deleteUnusedImage(data.url) })
    }
    if (path === '/api/admin/upload' && method === 'POST') {
      const data = await body(req)
      return json(res, 201, await uploadImage(data.data))
    }
    if (path === '/api/admin/me' && method === 'GET') return json(res, 200, identity)
    if (path === '/api/admin/consultations' && method === 'GET') {
      const rows = await list('consultationRequests')
      return json(
        res,
        200,
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      )
    }
    const consultationMatch = path.match(/^\/api\/admin\/consultations\/([a-f0-9-]{36})(\/retry)?$/)
    if (consultationMatch) {
      const id = consultationMatch[1]
      if (consultationMatch[2] && method === 'POST') {
        const data = parse(
          z.object({ channel: z.enum(['telegram', 'sheets']), confirmUncertain: z.boolean().optional() }),
          await body(req),
        )
        const current = await get('consultationRequests', id)
        if (!current) throw new HttpError(404, '접수를 찾을 수 없습니다.')
        const channel = current.deliveries[data.channel]
        if ((channel.status === 'uncertain' || channel.status === 'processing') && !data.confirmUncertain)
          throw new HttpError(409, '중복 전송 가능성이 있습니다. 수신 내역을 확인한 뒤 다시 시도해 주세요.')
        const deliveries = await deliver(id, [data.channel])
        await audit('연동 재시도', id, data.channel)
        return json(res, 200, deliveries)
      }
      if (method === 'PATCH') {
        const { note, ...patch } = parse(updateSchema, await body(req))
        const record = await mutate('consultationRequests', id, (r) => {
          if (!r) throw new HttpError(404, '접수를 찾을 수 없습니다.')
          return {
            ...r,
            ...patch,
            updatedAt: new Date().toISOString(),
            notes: note
              ? [
                  ...r.notes,
                  { id: randomUUID(), text: note, author: '관리자', createdAt: new Date().toISOString() },
                ]
              : r.notes,
            deliveries:
              'status' in patch || 'assignee' in patch
                ? { ...r.deliveries, sheets: { ...r.deliveries.sheets, status: 'pending' } }
                : r.deliveries,
          }
        })
        await audit(note ? '상담 메모 등록' : '상담 정보 변경', id, Object.keys(patch).join(', '))
        if ('status' in patch || 'assignee' in patch) {
          try {
            await deliver(id, ['sheets'])
          } catch {
            console.error('[consultation] sheet sync pending:', id)
          }
        }
        return json(res, 200, (await get('consultationRequests', id)) || record)
      }
      if (method === 'DELETE') {
        await mutate('consultationRequests', id, () => null)
        await audit('상담 개인정보 삭제', id)
        return json(res, 200, { ok: true })
      }
    }
    if (path === '/api/admin/content' && method === 'GET') return json(res, 200, await publicData(true))
    if (path === '/api/admin/content' && method === 'PUT') {
      const article = parse(articleSchema, await body(req))
      const saved = { ...article, updatedAt: new Date().toISOString() }
      await put('siteContent', article.id, saved)
      await audit('콘텐츠 저장', article.id, article.published ? '공개' : '비공개')
      return json(res, 200, saved)
    }
    const contentMatch = path.match(/^\/api\/admin\/content\/([a-z0-9-]+)$/)
    if (contentMatch && method === 'DELETE') {
      await put('siteContent', contentMatch[1], { id: contentMatch[1], deleted: true, published: false })
      await audit('콘텐츠 삭제', contentMatch[1])
      return json(res, 200, { ok: true })
    }
    if (path === '/api/admin/settings' && method === 'PUT') {
      const settings = parse(settingsSchema, await body(req))
      await put('siteSettings', 'main', settings)
      await audit('사이트 설정 변경', 'main')
      return json(res, 200, settings)
    }
    if (path === '/api/admin/audit' && method === 'GET') {
      const logs = await list('auditLogs')
      return json(res, 200, logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200))
    }
    if (path === '/api/admin/integrations' && method === 'GET')
      return json(res, 200, {
        configured: integrationConfig(),
        localPreview: isLocal() && !firebaseConfigured(),
      })
    throw new HttpError(404, '요청한 경로를 찾을 수 없습니다.')
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    if (status >= 500) console.error('[api]', req.method, req.url, e.name, e.code || 'server_error')
    return json(res, status, {
      error: e instanceof HttpError ? e.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    })
  }
}
