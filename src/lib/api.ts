export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(30000),
  })
  let data
  try {
    data = await response.json()
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', response.status)
  }
  if (!response.ok) throw new ApiError(data.error || '요청을 처리하지 못했습니다.', response.status)
  return data as T
}
export const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.name === 'TimeoutError'
      ? '응답이 늦어지고 있습니다. 같은 내용으로 다시 시도해 주세요.'
      : e.message
    : '요청을 처리하지 못했습니다.'
export const dateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음'
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(date)
}
export function csvDownload(rows: string[][], name: string) {
  const safe = (s: string) => `"${(/^[\s]*[=+@-]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`
  const blob = new Blob(['\uFEFF' + rows.map((row) => row.map(safe).join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
