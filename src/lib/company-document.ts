// 본문 편집기의 임시저장입니다. 이 브라우저에만 남으며, 저장에 성공하면 지웁니다.
// 저장 실패·차단된 저장소에서도 편집은 계속되도록 모든 접근을 예외 처리합니다.
export type DocumentDraft = { html: string; savedAt: number }
const draftStorageKey = (key: string) => `naran:company-draft:${key}`
export function readDocumentDraft(key: string): DocumentDraft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(draftStorageKey(key)) || 'null')
    return typeof draft?.html === 'string' && typeof draft.savedAt === 'number' ? draft : null
  } catch {
    return null
  }
}
export function writeDocumentDraft(key: string, html: string) {
  try {
    localStorage.setItem(draftStorageKey(key), JSON.stringify({ html, savedAt: Date.now() }))
    return true
  } catch {
    return false
  }
}
export function clearDocumentDraft(key: string) {
  try {
    localStorage.removeItem(draftStorageKey(key))
  } catch {
    // 저장소를 쓸 수 없으면 지울 임시저장도 없습니다.
  }
}
// 업로드 전 사진(blob:)은 창을 닫으면 사라지므로 임시저장을 불러올 때 제외합니다.
export function withoutLocalImages(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const local = doc.querySelectorAll('img[src^="blob:"]')
  for (const img of local) img.remove()
  for (const figure of doc.querySelectorAll('figure')) if (!figure.querySelector('img')) figure.remove()
  return { html: doc.body.innerHTML, removed: local.length }
}
