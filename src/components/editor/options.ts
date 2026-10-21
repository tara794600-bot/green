// 본문 편집기의 선택지입니다. 값 형식은 shared/company-document.mjs의 HTML 정제 규칙이 허용하는 범위와 맞춥니다.
export const fontSizes = ['11', '13', '15', '16', '19', '24', '28', '30', '34', '38']
export const lineHeights = [
  ['1', '100%'],
  ['1.2', '120%'],
  ['1.5', '150%'],
  ['1.8', '180% (기본)'],
  ['2', '200%'],
  ['2.5', '250%'],
  ['3', '300%'],
] as const
export const letterSpacings = [
  ['-0.08em', '-2 (아주 좁게)'],
  ['-0.04em', '-1 (좁게)'],
  ['', '0 (기본)'],
  ['0.04em', '1 (넓게)'],
  ['0.08em', '2 (더 넓게)'],
  ['0.15em', '3 (아주 넓게)'],
] as const
export const textColors = [
  ['#000000', '#3f3f3f', '#666666', '#8c8c8c', '#b3b3b3', '#d4d4d4', '#ececec', '#ffffff'],
  ['#e5212e', '#f2771a', '#f5b400', '#3aa63a', '#1a9bd7', '#2753d6', '#7039c2', '#d6338a'],
  ['#ffd6d6', '#ffe3c4', '#fff2b3', '#d6f2d1', '#cfeefb', '#d5e0fb', '#e5d8f7', '#f9d4e7'],
  ['#a3151f', '#a84d0b', '#9c7200', '#246b24', '#0e6690', '#183a99', '#4a2287', '#8f1f5b'],
  ['#203f36', '#355c4a', '#59754a', '#8ba16f', '#bd633f', '#b48a32', '#5a7fa4', '#54421b'],
]
export const highlightColors = [
  ['#fff3a3', '#ffe0b2', '#ffd6e0', '#e8dcff', '#d4efff', '#d8f3d4', '#e9ece5'],
  ['#ffe94d', '#ffbf66', '#ff9fbd', '#c7a8ff', '#8fd6ff', '#9fe39a', '#c9d0c3'],
]
export const quoteStyles = [
  ['quotation', '따옴표'],
  ['line', '버티컬 라인'],
  ['bubble', '말풍선'],
  ['underline', '라인 & 따옴표'],
  ['postit', '포스트잇'],
  ['frame', '프레임'],
] as const
export const dividerStyles = [
  ['line', '기본 선'],
  ['thick', '굵은 선'],
  ['double', '이중 선'],
  ['dashed', '파선'],
  ['dotted', '점선'],
  ['short', '짧은 선'],
  ['dots', '가운뎃점'],
  ['diamond', '다이아몬드'],
] as const
export type QuoteStyle = (typeof quoteStyles)[number][0]
export type DividerStyle = (typeof dividerStyles)[number][0]
export const emojis =
  '😀 😊 🙂 😍 🥰 😎 🤔 😮 😢 😭 😡 🙏 👍 👏 💪 👉 ✨ 🎉 🔥 💡 📌 📍 📎 ✅ ❌ ⚠️ ❗ ❓ 💯 ⭐ ❤️ 💛 💚 💙 💜 💰 💳 🏦 📈 📉 📞 📱 💬 📝 📅 ⏰ 🔒 🔑 ⚖️ 🏛️ 🚨 📢'.split(
    ' ',
  )
export const symbols =
  '※ ★ ☆ ● ○ ◎ ◆ ◇ ■ □ ▲ △ ▼ ▽ ▶ ▷ ◀ ◁ → ← ↑ ↓ ↔ ⇒ ♥ ♡ ✓ ✔ ✕ ① ② ③ ④ ⑤ ⑥ ⑦ ⑧ ⑨ ⑩ ㈜ ℃ ₩ ¥ € ㎡ ㎏ ㎝ ㎞ 「 」 『 』 【 】 〈 〉 《 》 · … ¶ §'.split(
    ' ',
  )

// 카드형 요소의 입력 항목입니다. 삽입 창과 본문 안 수정 창이 같은 정의를 사용합니다.
export type CardType = 'linkCard' | 'place' | 'schedule'
export type CardField = {
  key: string
  label: string
  type?: 'url' | 'date' | 'time'
  placeholder?: string
  required?: boolean
}
export const cardFields: Record<CardType, CardField[]> = {
  linkCard: [
    { key: 'url', label: '링크 주소', type: 'url', placeholder: 'https://', required: true },
    { key: 'title', label: '제목', placeholder: '비워 두면 사이트 주소를 표시합니다' },
    { key: 'description', label: '설명', placeholder: '링크에 대한 짧은 안내' },
  ],
  place: [
    { key: 'name', label: '장소 이름', placeholder: '예: 법무법인 나란', required: true },
    { key: 'address', label: '주소', placeholder: '지도 검색에 사용할 주소' },
  ],
  schedule: [
    { key: 'title', label: '일정 제목', placeholder: '예: 피해자 설명회', required: true },
    { key: 'date', label: '날짜', type: 'date', required: true },
    { key: 'time', label: '시간', type: 'time' },
    { key: 'location', label: '장소', placeholder: '선택 입력' },
  ],
}
export const cardLabels: Record<CardType, string> = { linkCard: '링크', place: '장소', schedule: '일정' }

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
// 도메인만 입력해도 https 주소로 바꿉니다. 링크에는 http(s)·메일·전화 주소만 허용합니다.
export function normalizeUrl(input: string, { contact = false } = {}) {
  const value = input.trim()
  if (contact && /^(?:mailto:|tel:)\S+$/i.test(value)) return value
  const url = /^https?:\/\//i.test(value)
    ? value
    : /^[\w-]+(?:\.[\w-]+)+(?:[/?#]\S*)?$/.test(value)
      ? 'https://' + value
      : ''
  try {
    return url && new URL(url).hostname ? url : ''
  } catch {
    return ''
  }
}
const weekdays = '일월화수목금토'
export function scheduleLabel(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  const day = weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${y}년 ${m}월 ${d}일 (${day})${time ? ' ' + time : ''}`
}

// 템플릿은 편집기 노드로 해석되는 HTML입니다. 빈 본문이면 전체를 채우고, 아니면 커서 위치에 넣습니다.
export const templates = [
  {
    name: '업체 피해 안내',
    description: '업체 개요 표 · 피해 유형 · 대응 방법',
    html: '<h2>업체 개요</h2><table><tbody><tr><th><p>항목</p></th><th><p>내용</p></th></tr><tr><td><p>업체명</p></td><td><p>업체명을 입력하세요</p></td></tr><tr><td><p>사용 주소 · 연락처</p></td><td><p>확인된 주소와 연락처</p></td></tr><tr><td><p>피해 유형</p></td><td><p>예: 코인 리딩방 투자 사기</p></td></tr></tbody></table><p></p><h2>확인된 피해 내용</h2><ul><li><p>연락을 주고받은 경로</p></li><li><p>요구받은 금액과 방식</p></li><li><p>현재 진행 상황</p></li></ul><blockquote data-style="postit"><p><strong>꼭 확인해 주세요</strong></p><p>입금 내역, 대화 기록, 계약서 등 관련 자료를 삭제하지 말고 보관해 주세요.</p></blockquote><hr data-style="dots"><h2>대응 방법</h2><ol><li><p>피해 자료를 정리합니다.</p></li><li><p>전문가와 상담해 대응 방향을 정합니다.</p></li><li><p>필요한 법적 절차를 진행합니다.</p></li></ol>',
  },
  {
    name: '상담 준비 체크리스트',
    description: '준비할 자료를 체크리스트로 정리',
    html: '<h2>상담 전 준비할 자료</h2><p>아래 자료를 미리 준비하시면 상담이 빨라집니다.</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>입금 · 이체 내역</p></li><li data-type="taskItem" data-checked="false"><p>대화 기록 캡처 (메신저, 문자)</p></li><li data-type="taskItem" data-checked="false"><p>업체 사이트 주소와 화면 캡처</p></li><li data-type="taskItem" data-checked="false"><p>계약서 · 안내 문서</p></li></ul><blockquote data-style="line"><p>자료가 모두 없어도 상담할 수 있습니다. 기억나는 내용부터 정리해 주세요.</p></blockquote>',
  },
  {
    name: '진행 절차 안내',
    description: '단계별 절차와 강조 인용구',
    html: '<blockquote data-style="quotation"><p>지금 상황을 정확히 아는 것이 회복의 첫걸음입니다.</p></blockquote><h2>진행 절차</h2><h3>1단계 · 상황 확인</h3><p>피해 경위와 현재 상황을 확인합니다.</p><h3>2단계 · 자료 정리</h3><p>필요한 증빙 자료를 함께 정리합니다.</p><h3>3단계 · 대응 진행</h3><p>사건에 맞는 법적 대응을 진행합니다.</p><hr data-style="short"><p style="text-align: center">궁금한 점은 언제든 상담으로 문의해 주세요.</p>',
  },
]
