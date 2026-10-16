import { google } from 'googleapis'
import { randomUUID } from 'node:crypto'
import { get, mutate, firebaseConfigured } from './store.mjs'
import { HttpError } from './validation.mjs'

// 키의 존재 여부만 확인합니다. 실제 권한·수신 성공은 별도 접수로 검증해야 합니다.
export const integrationConfig = () => ({
  firebase: firebaseConfigured(),
  telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  sheets: Boolean(
    process.env.GOOGLE_SHEET_ID &&
    (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  ),
})
const statusLabels = {
  new: '신규 접수',
  contacted: '연락 완료',
  scheduled: '상담 예정',
  completed: '상담 완료',
  closed: '종결',
}
// OPERATIONS.md의 시트 A~P 열 순서와 일치해야 합니다. 열을 바꾸면 기존 문서도 함께 맞추세요.
export function sheetRow(r) {
  return [
    r.id,
    r.createdAt,
    r.name,
    r.phone,
    r.category,
    r.details,
    r.preferredTime,
    statusLabels[r.status],
    r.assignee,
    r.source,
    r.consentAt,
    r.visitSource || '',
    r.keyword || '',
    r.landingPath || '',
    r.queryString || '',
    r.referrer || '',
  ]
}
export function telegramText(r) {
  return [
    '📩 나란 · 새로운 상담 신청',
    `접수번호: ${r.id}`,
    `성함: ${r.name}`,
    `연락처: ${r.phone}`,
    `분야: ${r.category}`,
    `유입 경로: ${r.visitSource || '직접 방문'}`,
    `광고·검색 키워드: ${r.keyword || '없음'}`,
    `연락 가능 시간: ${r.preferredTime || '미지정'}`,
    `내용: ${r.details.slice(0, 1800) || '미입력'}`,
    `관리자: ${process.env.SITE_URL || ''}/admin`,
  ].join('\n')
}
export async function sendTelegram(r) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: telegramText(r),
      link_preview_options: { is_disabled: true },
    }),
    signal: AbortSignal.timeout(10000),
  })
  const result = await response.json()
  if (!response.ok || !result.ok)
    throw new HttpError(response.status, '텔레그램 전송에 실패했습니다. 봇과 채팅 권한을 확인해 주세요.')
  return { messageId: result.result.message_id }
}
export async function syncSheet(r) {
  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  )
  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth }),
    spreadsheetId = process.env.GOOGLE_SHEET_ID
  const tab = "'" + (process.env.GOOGLE_SHEET_NAME || '상담접수').replace(/'/g, "''") + "'"
  const existing = await sheets.spreadsheets.values.get(
    { spreadsheetId, range: `${tab}!A:A` },
    { timeout: 10000, retry: false },
  )
  // 접수번호로 기존 행을 찾아 갱신합니다. 조회와 쓰기는 하나의 원자적 작업이 아닙니다.
  const row = existing.data.values?.findIndex((v) => v[0] === r.id) ?? -1
  // RAW로 기록해 사용자 입력이 시트 수식으로 실행되지 않게 합니다.
  const params = { spreadsheetId, valueInputOption: 'RAW', requestBody: { values: [sheetRow(r)] } }
  if (row >= 0)
    await sheets.spreadsheets.values.update(
      { ...params, range: `${tab}!A${row + 1}:P${row + 1}` },
      { timeout: 10000, retry: false },
    )
  else
    await sheets.spreadsheets.values.append(
      { ...params, range: `${tab}!A:P`, insertDataOption: 'INSERT_ROWS' },
      { timeout: 10000, retry: false },
    )
  return { message: '접수번호 기준으로 시트에 반영했습니다.' }
}
// 채널별 전송 잠금을 DB에 보관해 동시 재시도를 제한합니다. 타임아웃은 수신 여부가 불명확한 상태입니다.
export async function deliver(
  id,
  channels = ['telegram', 'sheets'],
  adapters = { telegram: sendTelegram, sheets: syncSheet },
) {
  const configured = integrationConfig()
  await Promise.all(
    channels.map(async (channel) => {
      const attemptId = randomUUID(),
        now = Date.now()
      // 각 채널은 독립적으로 잠금을 얻고 결과를 기록하므로 한 채널의 실패가 다른 채널을 막지 않습니다.
      const record = await mutate('consultationRequests', id, (r) => {
        if (!r) throw new HttpError(404, '접수를 찾을 수 없습니다.')
        const old = r.deliveries[channel]
        if (old.status === 'sent' || (old.status === 'processing' && old.leaseUntil > now)) return r
        if (!configured[channel])
          return {
            ...r,
            deliveries: {
              ...r.deliveries,
              [channel]: {
                ...old,
                status: 'unconfigured',
                updatedAt: new Date().toISOString(),
                message: '서버 연결 설정이 필요합니다.',
              },
            },
          }
        return {
          ...r,
          deliveries: {
            ...r.deliveries,
            [channel]: {
              ...old,
              status: 'processing',
              attempts: old.attempts + 1,
              attemptId,
              leaseUntil: now + 60000,
              updatedAt: new Date().toISOString(),
            },
          },
        }
      })
      if (record.deliveries[channel].attemptId !== attemptId) return
      let result
      try {
        result = { status: 'sent', ...(await adapters[channel](record)), message: '전송 완료' }
      } catch (e) {
        result = {
          status:
            e.name === 'TimeoutError' || e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET'
              ? 'uncertain'
              : 'failed',
          message: '전송 결과를 확인하지 못했습니다. 연동 설정과 수신 내역을 확인해 주세요.',
        }
      }
      // 현재 시도의 식별자가 일치할 때만 결과를 반영해 늦게 끝난 이전 요청의 덮어쓰기를 막습니다.
      await mutate('consultationRequests', id, (r) =>
        r.deliveries[channel].attemptId === attemptId
          ? {
              ...r,
              deliveries: {
                ...r.deliveries,
                [channel]: {
                  ...r.deliveries[channel],
                  ...result,
                  updatedAt: new Date().toISOString(),
                  leaseUntil: 0,
                },
              },
            }
          : r,
      )
    }),
  )
  return (await get('consultationRequests', id)).deliveries
}
