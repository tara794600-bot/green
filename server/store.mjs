import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import seed from '../shared/content.json' with { type: 'json' }
import { HttpError } from './validation.mjs'

// 로컬 파일 저장은 개발 서버에서만 허용합니다. 운영에서는 Firebase 설정이 필요합니다.
export const isLocal = () => process.env.LOCAL_PREVIEW === 'true' && process.env.NODE_ENV !== 'production'
export const firebaseConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
let db
export function firestore() {
  if (!firebaseConfigured())
    throw new HttpError(503, '서버 연결 설정을 준비하고 있습니다. 대표전화로 문의해 주세요.')
  if (!db) {
    const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n')
    const app = getApps()[0] || initializeApp({ credential: cert(account) })
    db = getFirestore(app)
  }
  return db
}
const localFile = () => resolve(process.env.LOCAL_DATA_FILE || '.local/naran.json')
// 한 프로세스의 파일 읽기·수정을 직렬화해 동시 요청이 서로의 변경을 덮어쓰지 않게 합니다.
let queue = Promise.resolve()
async function localOperation(fn, write = false) {
  const pending = queue.then(async () => {
    let data
    try {
      data = JSON.parse(await readFile(localFile(), 'utf8'))
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
      data = {}
    }
    const result = await fn(data)
    if (!write) return result
    await mkdir(dirname(localFile()), { recursive: true })
    // 완성된 임시 파일로 교체합니다. Windows 파일 잠금은 짧게 재시도합니다.
    const temp = localFile() + '.' + randomUUID() + '.tmp'
    await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 })
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(temp, localFile())
        break
      } catch (e) {
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || attempt >= 5) throw e
        await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)))
      }
    }
    return result
  })
  queue = pending.catch(() => {})
  return pending
}
// 개발 모드라도 Firebase 키가 있으면 실제 연결된 DB를 사용합니다.
const useLocal = () => isLocal() && !firebaseConfigured()
export async function get(collection, id) {
  if (useLocal()) return localOperation((d) => d[collection]?.[id] || null)
  const doc = await firestore().collection(collection).doc(id).get()
  return doc.exists ? doc.data() : null
}
export async function list(collection) {
  if (useLocal())
    return localOperation((d) => Object.entries(d[collection] || {}).map(([id, value]) => ({ ...value, id })))
  return (await firestore().collection(collection).get()).docs.map((d) => ({ ...d.data(), id: d.id }))
}
export const storageAvailable = () => useLocal() || firebaseConfigured()
export const dateString = (v) => (v?.toDate ? v.toDate().toISOString() : typeof v === 'string' ? v : '')
export const companyVisibility = (v) =>
  v.isPublic === false ? 'phone' : v.isSearchBlocked === true ? 'searchBlocked' : 'public'
// 기존 Firestore Timestamp와 로컬 JSON의 문자열 날짜를 같은 형식으로 맞춥니다.
export function normalizeRecord(v) {
  return { ...v, createdAt: dateString(v.createdAt), updatedAt: dateString(v.updatedAt || v.createdAt) }
}
export async function allCompanies() {
  return storageAvailable()
    ? (await list('companyCases')).map((v) => ({ ...normalizeRecord(v), visibility: companyVisibility(v) }))
    : []
}
// fn은 새 문서 또는 삭제를 뜻하는 null을 반환합니다.
// Firestore는 충돌 시 fn을 재실행할 수 있으므로 외부 전송·파일 삭제는 콜백 밖에서 수행합니다.
export async function mutate(collection, id, fn) {
  if (useLocal())
    return localOperation(async (d) => {
      d[collection] ||= {}
      const value = await fn(d[collection][id] || null)
      if (value === null) delete d[collection][id]
      else d[collection][id] = value
      return value
    }, true)
  const ref = firestore().collection(collection).doc(id)
  return firestore().runTransaction(async (tx) => {
    const old = await tx.get(ref)
    const value = await fn(old.exists ? old.data() : null)
    if (value === null) tx.delete(ref)
    else tx.set(ref, value)
    return value
  })
}
export const put = (collection, id, value) => mutate(collection, id, () => value)
export async function publicData(includeDrafts = false) {
  const available = useLocal() || firebaseConfigured()
  const [saved, settings, rollingCases, companies] = available
    ? await Promise.all([
        list('siteContent'),
        get('siteSettings', 'main'),
        list('rollingCases'),
        allCompanies(),
      ])
    : [[], null, [], []]
  // 기본 콘텐츠에 관리자 저장값을 덮어씁니다. 삭제 표식도 병합해야 기본 글이 되살아나지 않습니다.
  const merged = new Map(seed.articles.map((a) => [a.id, a]))
  saved.forEach((a) => merged.set(a.id, a))
  return {
    articles: [...merged.values()].filter((a) => !a.deleted && (includeDrafts || a.published)),
    settings: { ...seed.settings, ...settings },
    rollingCases: rollingCases.map(normalizeRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    companies: companies
      .filter((c) => c.visibility === 'public')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}
// 카운터를 저장소에서 갱신하므로 Firebase 연결 시 여러 서버 인스턴스에서도 제한을 공유합니다.
export async function rateLimit(key, max, windowMs) {
  const id = createHash('sha256').update(key).digest('hex'),
    now = Date.now()
  await mutate('rateLimits', id, (old) => {
    const value = old && old.until > now ? old : { count: 0, until: now + windowMs }
    if (value.count >= max) throw new HttpError(429, '요청이 많습니다. 잠시 후 다시 시도해 주세요.')
    return { ...value, count: value.count + 1 }
  })
}
export async function audit(action, target, detail = '') {
  const id = randomUUID()
  await put('auditLogs', id, {
    id,
    action,
    target,
    detail,
    actor: '관리자',
    createdAt: new Date().toISOString(),
  })
}
