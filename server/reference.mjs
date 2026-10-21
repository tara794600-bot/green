import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  allCompanies,
  audit,
  get,
  isLocal,
  list,
  mutate,
  normalizeRecord,
  publicData,
  storageAvailable,
} from './store.mjs'
import { companySchema, rollingSchema, HttpError, parse } from './validation.mjs'
import { deleteUnusedImage } from './media.mjs'
import { documentImageUrls } from '../shared/company-document-schema.mjs'
import { companyUrls, notifySearchEngines } from './seo.mjs'

// 광고 경로는 한 단계로 제한하고 기존 공개·관리자·API 경로와 충돌하지 않도록 합니다.
export function powerlinkPrefix() {
  const prefix = '/' + (process.env.POWERLINK_PATH_PREFIX || 'p').replace(/^\/+|\/+$/g, '') + '/'
  if (
    !/^\/[a-zA-Z0-9_-]+\/$/.test(prefix) ||
    /^\/(api|admin|companies|cases|practice|guides|lawyers|consultation|about|faq|contact|privacy)\/$/.test(
      prefix,
    )
  )
    throw new HttpError(503, 'POWERLINK_PATH_PREFIX 설정을 확인해 주세요.')
  return prefix
}
// 개발에서는 비밀값을 최초 생성 후 저장합니다. 키가 바뀌면 기존 광고 URL도 해석할 수 없습니다.
async function encryptionKey(create = false) {
  let secret = process.env.POWERLINK_URL_SECRET
  if (!secret && isLocal()) {
    const value = create
      ? await mutate(
          'privateSettings',
          'powerlink',
          (old) => old || { secret: randomBytes(32).toString('hex') },
        )
      : storageAvailable()
        ? await get('privateSettings', 'powerlink')
        : null
    secret = value?.secret
  }
  if (!secret) return null
  return createHash('sha256').update(secret).digest()
}
export async function decryptKeyword(token) {
  if (!token || !/^[a-zA-Z0-9_-]{38,800}$/.test(token)) return ''
  const key = await encryptionKey()
  if (!key) return ''
  try {
    // 토큰은 IV 12바이트 + 인증 태그 16바이트 + 암호문이며, 생성부와 형식이 같아야 합니다.
    const payload = Buffer.from(token, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12))
    decipher.setAuthTag(payload.subarray(12, 28))
    const keyword = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8')
    return keyword.length <= 120 ? keyword : ''
  } catch {
    return ''
  }
}
const collections = { rolling: 'rollingCases', companies: 'companyCases', powerlinks: 'powerlinkLinks' }
const labels = { rolling: '홈 롤링 사례', companies: '사기업체 정보', powerlinks: '파워링크' }
const searchable = (v) =>
  [v.name, v.service, v.description, v.category, v.title, v.result, v.keyword]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
export async function referenceAdmin(path, method, url, readBody, req) {
  const match = path.match(/^\/api\/admin\/(rolling|companies|powerlinks)(?:\/([a-zA-Z0-9_-]{1,128}))?$/)
  if (!match) return null
  const [, kind, id] = match,
    collection = collections[kind]
  if (method === 'GET' && !id) {
    const all = kind === 'companies' ? await allCompanies() : (await list(collection)).map(normalizeRecord)
    const query = (url.searchParams.get('q') || '').trim().toLowerCase()
    // 전체 데이터에서 검색한 다음 페이지를 잘라 현재 페이지 밖의 결과도 검색되게 합니다.
    const filtered = all
      .filter((v) => searchable(v).includes(query))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    const pages = Math.max(1, Math.ceil(filtered.length / 30))
    const page = Math.min(pages, Math.max(1, Number.parseInt(url.searchParams.get('page'), 10) || 1))
    return {
      items: filtered.slice((page - 1) * 30, page * 30),
      page,
      pages,
      total: all.length,
      filtered: filtered.length,
    }
  }
  if (method === 'POST' && !id && kind === 'powerlinks') {
    const { keyword } = parse(
      z.object({ keyword: z.string().trim().min(1).max(120) }).strict(),
      await readBody(),
    )
    const key = await encryptionKey(true)
    if (!key) throw new HttpError(503, '서버에 POWERLINK_URL_SECRET 설정이 필요합니다.')
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(keyword, 'utf8'), cipher.final()])
    const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
    const path = powerlinkPrefix() + token
    const base =
      process.env.POWERLINK_BASE_URL || process.env.SITE_URL || (isLocal() ? req.headers.origin : '')
    if (!base || !/^https?:\/\//.test(base))
      throw new HttpError(503, '서버에 SITE_URL 또는 POWERLINK_BASE_URL 설정이 필요합니다.')
    const value = {
      id: randomUUID(),
      keyword,
      token,
      path,
      url: new URL(path, base).href,
      createdAt: new Date().toISOString(),
    }
    await mutate(collection, value.id, () => value)
    await audit('파워링크 생성', value.id, keyword)
    return value
  }
  if (((method === 'POST' && !id) || (method === 'PUT' && id)) && kind !== 'powerlinks') {
    const payload = parse(kind === 'companies' ? companySchema : rollingSchema, await readBody())
    const recordId = id || randomUUID(),
      now = new Date().toISOString()
    let previousImages = []
    const value = await mutate(collection, recordId, (old) => {
      if (id && !old) throw new HttpError(404, '등록된 항목이 없습니다.')
      previousImages = documentImageUrls(old)
      const { visibility, ...fields } = payload
      return {
        ...fields,
        ...(kind === 'companies' && !fields.document && old?.document ? { document: old.document } : {}),
        id: recordId,
        createdAt: normalizeRecord(old || {}).createdAt || now,
        updatedAt: now,
        ...(kind === 'companies'
          ? { isPublic: visibility !== 'phone', isSearchBlocked: visibility === 'searchBlocked' }
          : {}),
      }
    })
    // 저장 후 참조가 사라진 이미지만 정리합니다. 정리 실패는 저장 취소 대신 경고로 반환합니다.
    const currentImages = documentImageUrls(value)
    const warnings = await Promise.all(
      previousImages.filter((url) => !currentImages.includes(url)).map(deleteUnusedImage),
    )
    const warning = warnings.find(Boolean) || ''
    await audit(`${labels[kind]} ${id ? '수정' : '등록'}`, recordId)
    if (kind === 'companies') await notifySearchEngines(companyUrls(recordId))
    return { ...value, ...(kind === 'companies' ? { visibility: payload.visibility } : {}), warning }
  }
  if (method === 'PATCH' && id && kind === 'companies') {
    const { visibility } = parse(
      z.object({ visibility: z.enum(['public', 'phone', 'searchBlocked']) }).strict(),
      await readBody(),
    )
    const value = await mutate(collection, id, (old) => {
      if (!old) throw new HttpError(404, '등록된 항목이 없습니다.')
      return {
        ...old,
        id,
        isPublic: visibility !== 'phone',
        isSearchBlocked: visibility === 'searchBlocked',
        updatedAt: new Date().toISOString(),
      }
    })
    await audit('사기업체 노출 설정 변경', id, visibility)
    await notifySearchEngines(companyUrls(id))
    return { ...normalizeRecord(value), visibility }
  }
  // 파워링크는 관리 목록만 삭제합니다. 토큰 복호화는 목록 조회와 독립적이므로 기존 URL은 유지됩니다.
  if (method === 'DELETE' && id) {
    let old
    await mutate(collection, id, (value) => {
      old = value
      return null
    })
    const warnings = await Promise.all(documentImageUrls(old).map(deleteUnusedImage))
    const warning = warnings.find(Boolean) || ''
    await audit(`${labels[kind]} 삭제`, id)
    // 삭제한 주소도 알려 검색 결과에서 빨리 빠지게 합니다.
    if (kind === 'companies') await notifySearchEngines(companyUrls(id))
    return { ok: true, warning }
  }
  throw new HttpError(405, '지원하지 않는 요청입니다.')
}
// 내부 검색에서 숨긴 업체도 직접 주소로 조회할 수 있으며, 노출 방식은 상세 화면이 처리합니다.
export async function companyDetail(id) {
  if (!storageAvailable() || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null
  const record = await get('companyCases', id)
  if (!record) return null
  const visibility =
    record.isPublic === false ? 'phone' : record.isSearchBlocked === true ? 'searchBlocked' : 'public'
  return { ...normalizeRecord(record), id, visibility }
}
export async function landingData(token) {
  const keyword = await decryptKeyword(token)
  if (!keyword) return null
  const terms = keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !['변호사', '법무법인', '상담', '나란'].includes(t))
  const companies = (await allCompanies())
    .filter((v) => terms.some((term) => searchable(v).includes(term)))
    .slice(0, 8)
  return { token, keyword, companies }
}
// SSR과 브라우저 콘텐츠 API가 같은 기본 데이터와 경로별 상세 데이터를 사용하도록 모읍니다.
export async function requestPublicData(pathname = '/') {
  const data = { ...(await publicData()), powerlinkPrefix: powerlinkPrefix() }
  if (/^\/companies\/[^/]+$/.test(pathname))
    data.selectedCompany = await companyDetail(pathname.split('/')[2])
  if (pathname.startsWith(data.powerlinkPrefix))
    data.landing = await landingData(pathname.slice(data.powerlinkPrefix.length))
  return data
}
// 토큰에서 복호화한 키워드를 우선하고, 없으면 검색 매개변수와 참조 주소로 유입을 분류합니다.
export async function attribution(fields) {
  const params = new URLSearchParams(fields.queryString)
  const token = fields.landingPath.startsWith(powerlinkPrefix())
    ? fields.landingPath.slice(powerlinkPrefix().length).split('?')[0]
    : ''
  const keyword =
    (await decryptKeyword(token)) ||
    ['n_keyword', 'n_query', 'keyword', 'query', 'utm_term'].map((key) => params.get(key)).find(Boolean) ||
    ''
  let referrerHost = ''
  try {
    referrerHost = new URL(fields.referrer).hostname
  } catch {
    /* direct visit */
  }
  const visitSource =
    token || params.has('n_keyword') || params.has('n_query') || params.has('NaPm')
      ? '네이버 파워링크'
      : params.has('gclid') || params.has('gbraid') || params.has('wbraid')
        ? '구글 광고'
        : /(^|\.)naver\.com$/.test(referrerHost)
          ? '네이버 검색'
          : /(^|\.)google\.[a-z.]+$/.test(referrerHost)
            ? '구글 검색'
            : params.get('utm_source') || (referrerHost ? '외부 사이트' : '직접 방문')
  return {
    keyword: keyword.slice(0, 120),
    landingToken: token.slice(0, 800),
    visitSource: visitSource.slice(0, 120),
  }
}
