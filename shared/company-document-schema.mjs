import { z } from 'zod'

// API 검증·이미지 정리에서 HTML 렌더링 라이브러리를 불러오지 않도록 스키마를 별도 분리합니다.
// version 2는 편집기가 만든 HTML 본문입니다. Firestore 문서 한도(1MiB) 안에 들어가도록 길이를 제한합니다.
export const MAX_DOCUMENT_HTML = 200000
export const MAX_DOCUMENT_IMAGES = 60

// version 1은 이전 블록 편집기 형식입니다. 저장된 자료를 읽고 그대로 유지하기 위해 검증 규칙을 남겨 둡니다.
export const MAX_BLOCKS = 80
export const MAX_DOCUMENT_LENGTH = 100000
export const blockTypes = ['markdown', 'callout', 'stat', 'mermaid', 'html', 'image', 'divider']
const color = z.string().regex(/^#[\da-f]{6}$/i)
export const blockStyleSchema = z
  .object({
    color,
    background: z.union([color, z.literal('transparent')]),
    borderColor: color,
    accent: color,
    shadow: z.enum(['none', 'soft', 'strong']),
    animation: z.enum(['none', 'fade', 'pulse', 'float']),
    align: z.enum(['left', 'center', 'right']),
    radius: z.number().int().min(0).max(40),
    padding: z.number().int().min(0).max(64),
    borderWidth: z.number().int().min(0).max(8),
    fontSize: z.number().int().min(12).max(72),
  })
  .strict()
const legacyDocumentSchema = z
  .object({
    version: z.literal(1),
    blocks: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
            type: z.enum(blockTypes),
            content: z.string().max(20000, '블록 하나에는 최대 20,000자를 입력할 수 있습니다.'),
            caption: z.string().max(300),
            style: blockStyleSchema,
          })
          .strict(),
      )
      .max(MAX_BLOCKS, '본문은 최대 80개 블록까지 추가할 수 있습니다.'),
  })
  .strict()
  // 블록별 제한 외에 문서 전체 크기와 ID 고유성을 검사합니다.
  .superRefine((doc, ctx) => {
    if (new Set(doc.blocks.map((b) => b.id)).size !== doc.blocks.length)
      ctx.addIssue({ code: 'custom', message: '블록 ID가 중복되었습니다.' })
    if (doc.blocks.reduce((sum, b) => sum + b.content.length + b.caption.length, 0) > MAX_DOCUMENT_LENGTH)
      ctx.addIssue({ code: 'custom', message: '본문은 최대 100,000자까지 저장할 수 있습니다.' })
    for (const b of doc.blocks) {
      if (b.type === 'image' && b.content && !isImageUrl(b.content))
        ctx.addIssue({ code: 'custom', message: '본문 이미지는 업로드하거나 HTTPS 주소를 입력해 주세요.' })
    }
  })
const htmlDocumentSchema = z
  .object({
    version: z.literal(2),
    html: z.string().max(MAX_DOCUMENT_HTML, '본문 용량이 너무 큽니다. 사진이나 표 일부를 나눠 주세요.'),
  })
  .strict()
  // 업로드 전 미리보기 주소(blob:)나 외부 비보안 주소가 저장되지 않도록 본문 이미지 주소를 검사합니다.
  .superRefine((doc, ctx) => {
    const sources = htmlImageSources(doc.html)
    if (sources.some((src) => !isImageUrl(src)))
      ctx.addIssue({ code: 'custom', message: '본문 이미지는 업로드하거나 HTTPS 주소를 입력해 주세요.' })
    if (sources.length > MAX_DOCUMENT_IMAGES)
      ctx.addIssue({
        code: 'custom',
        message: `본문 사진은 최대 ${MAX_DOCUMENT_IMAGES}장까지 넣을 수 있습니다.`,
      })
  })
export const companyDocumentSchema = z.discriminatedUnion('version', [
  htmlDocumentSchema,
  legacyDocumentSchema,
])

export function isImageUrl(value) {
  return (
    /^https:\/\/[^\s]+$/i.test(value) ||
    /^\/(?:images\/[\w./-]+|api\/media\/[a-f0-9-]{36}\.webp)$/.test(value)
  )
}

const entity = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }
export function htmlImageSources(html) {
  return [...html.matchAll(/<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map((m) =>
    (m[1] ?? m[2] ?? m[3]).replace(/&(?:amp|quot|#39|lt|gt);/g, (e) => entity[e]),
  )
}

export function documentImageUrls(record) {
  const urls = new Set(record?.image ? [record.image] : [])
  const doc = record?.document
  const sources = typeof doc?.html === 'string' ? [doc.html] : []
  for (const block of doc?.blocks || []) {
    if (block.type === 'image' && block.content) urls.add(block.content)
    sources.push(block.content)
  }
  // 대표 이미지를 본문에서 재사용한 경우에도 삭제하지 않도록 업로드 파일 참조를 모두 수집합니다.
  for (const source of sources)
    for (const match of source.matchAll(
      /(?:\/api\/media\/[a-f0-9-]{36}\.webp|https:\/\/firebasestorage\.googleapis\.com\/[^\s<>"')]+)/g,
    ))
      urls.add(match[0].replaceAll('&amp;', '&'))
  return [...urls]
}
