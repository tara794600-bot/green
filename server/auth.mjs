import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { get, put, mutate, isLocal, rateLimit } from './store.mjs'
import { HttpError } from './validation.mjs'

// 솔트와 scrypt 결과만 저장합니다. 로그인 비교에는 같은 솔트를 재사용합니다.
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return salt + ':' + scryptSync(password, salt, 64).toString('hex')
}
export function verifyPassword(password, hash) {
  try {
    const [salt, key] = hash.split(':')
    const expected = Buffer.from(key, 'hex'),
      actual = scryptSync(password, salt, 64)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
export const loopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)
export async function passwordConfigured() {
  return Boolean(
    process.env.ADMIN_PASSWORD_HASH || (isLocal() && (await get('privateSettings', 'auth'))?.hash),
  )
}
async function currentHash() {
  return process.env.ADMIN_PASSWORD_HASH || (isLocal() && (await get('privateSettings', 'auth'))?.hash)
}
const sessionKey = (token) => createHash('sha256').update(token).digest('hex')
function cookie(req) {
  return /(?:^|; )naran_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]
}
export async function requireAdmin(req) {
  const token = cookie(req)
  if (!token) throw new HttpError(401, '관리자 로그인이 필요합니다.')
  // 저장소에는 세션 토큰의 해시만 보관하며, 비밀번호 버전 변경 시 기존 세션을 거절합니다.
  const session = await get('adminSessions', sessionKey(token))
  const hash = await currentHash()
  if (!session || session.expiresAt < Date.now() || !hash || session.passwordVersion !== sessionKey(hash))
    throw new HttpError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.')
  return { uid: 'administrator', email: '관리자', role: 'admin' }
}
export async function login(req, res, password, setup = false) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    throw new HttpError(400, '비밀번호는 8~128자로 입력해 주세요.')
  await rateLimit('login:' + clientIp(req), 5, 15 * 60 * 1000)
  // 최초 비밀번호 생성은 루프백 개발 접속에 한정합니다. 운영 설정은 서버 환경변수로 전달합니다.
  if (setup) {
    if (!isLocal() || !loopback(req) || process.env.ADMIN_PASSWORD_HASH)
      throw new HttpError(403, '초기 비밀번호는 서버 환경에서 설정해 주세요.')
    await mutate('privateSettings', 'auth', (old) => {
      if (old?.hash) throw new HttpError(409, '비밀번호가 이미 설정되었습니다.')
      return { hash: hashPassword(password) }
    })
  }
  const hash = await currentHash()
  if (!hash) throw new HttpError(503, '서버에 관리자 비밀번호 설정이 필요합니다.')
  if (!verifyPassword(password, hash)) throw new HttpError(401, '비밀번호가 일치하지 않습니다.')
  const token = randomBytes(32).toString('hex')
  await put('adminSessions', sessionKey(token), {
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    passwordVersion: sessionKey(hash),
  })
  res.setHeader(
    'Set-Cookie',
    `naran_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${isLocal() ? '' : '; Secure'}`,
  )
  return { uid: 'administrator', email: '관리자', role: 'admin' }
}
export async function logout(req, res) {
  const token = cookie(req)
  if (token) await mutate('adminSessions', sessionKey(token), () => null)
  res.setHeader(
    'Set-Cookie',
    `naran_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isLocal() ? '' : '; Secure'}`,
  )
}
// 프록시 헤더는 Vercel 환경에서만 사용하고, 그 외에는 소켓 주소를 사용합니다.
export function clientIp(req) {
  return process.env.VERCEL
    ? String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
        .split(',')[0]
        .trim()
    : req.socket?.remoteAddress || 'unknown'
}
// 쿠키가 동반되는 쓰기 요청의 출처를 SITE_URL과 비교해 다른 사이트의 요청을 차단합니다.
export function checkOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, '허용되지 않은 요청입니다.')
  const origin = req.headers.origin
  if (!origin) throw new HttpError(403, '요청 출처를 확인할 수 없습니다.')
  const expected = process.env.SITE_URL
  const allowed = expected
    ? new URL(expected).origin
    : `${isLocal() ? 'http' : 'https'}://${req.headers.host}`
  if (origin !== allowed) throw new HttpError(403, '허용되지 않은 요청입니다.')
}
