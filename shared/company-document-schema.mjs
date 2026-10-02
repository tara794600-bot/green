import { z } from 'zod'

// API validation and media cleanup must not load browser/HTML rendering libraries.
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
export const companyDocumentSchema = z
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

export function isImageUrl(value) {
  return (
    /^https:\/\/[^\s]+$/i.test(value) ||
    /^\/(?:images\/[\w./-]+|api\/media\/[a-f0-9-]{36}\.webp)$/.test(value)
  )
}

export function documentImageUrls(record) {
  const urls = new Set(record?.image ? [record.image] : [])
  for (const block of record?.document?.blocks || []) {
    if (block.type === 'image' && block.content) urls.add(block.content)
    // Preserve an uploaded cover reused inside Markdown or HTML as well.
    for (const match of block.content.matchAll(
      /(?:\/api\/media\/[a-f0-9-]{36}\.webp|https:\/\/firebasestorage\.googleapis\.com\/[^\s<>"')]+)/g,
    ))
      urls.add(match[0].replaceAll('&amp;', '&'))
  }
  return [...urls]
}
