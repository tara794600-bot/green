import { z } from 'zod'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

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

// A shared allowlist keeps browser previews and server-rendered documents identical.
// Presentation styles stay inside the article: no scripts, handlers, forms or positioning.
const cssColor = /^(?:#[\da-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/i
const size = /^(?:0|\d{1,3}(?:\.\d+)?(?:px|em|rem|%))$/
export function sanitizeContent(html) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'mark', 'del', 'details', 'summary', 'input'],
    allowedAttributes: {
      '*': ['style', 'class', 'title'],
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'loading'],
      input: ['type', 'checked', 'disabled'],
      td: ['colspan', 'rowspan', 'style'],
      th: ['colspan', 'rowspan', 'style'],
    },
    allowedClasses: { '*': ['doc-highlight', 'doc-number', 'doc-box', 'doc-fade', 'doc-pulse', 'doc-float'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        color: [cssColor],
        'background-color': [cssColor],
        'border-color': [cssColor],
        'font-size': [/^(?:\d|[1-6]\d|7[0-2])px$/, /^[0-3](?:\.\d+)?(?:em|rem)$/],
        'font-weight': [/^(?:normal|bold|[1-9]00)$/],
        'font-style': [/^(?:normal|italic)$/],
        'text-align': [/^(?:left|center|right)$/],
        'text-decoration': [/^(?:underline|line-through|none)$/],
        'border-radius': [size],
        padding: [size],
        margin: [size],
        'border-width': [/^[0-8]px$/],
        'border-style': [/^(?:solid|dashed|dotted|none)$/],
        'box-shadow': [/^(?:none|0 \d{1,2}px \d{1,2}px (?:#[\da-f]{6,8}|rgba?\([\d.,\s]+\)))$/i],
      },
    },
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }),
      input: (_tagName, attribs) => ({
        tagName: 'input',
        attribs: {
          type: 'checkbox',
          disabled: '',
          ...(Object.hasOwn(attribs, 'checked') ? { checked: '' } : {}),
        },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          src: isImageUrl(attribs.src || '') ? attribs.src : '',
          loading: 'lazy',
        },
      }),
    },
  })
}

export function markdownParts(source) {
  const parts = []
  let pending = []
  const flush = () => {
    if (pending.length)
      parts.push({
        kind: 'html',
        content: sanitizeContent(marked.parser(pending, { async: false, gfm: true, breaks: true })),
      })
    pending = []
  }
  const tokens = marked.lexer(source, { gfm: true, breaks: true })
  // Reference links require the lexer's link table after splitting at diagram fences.
  pending.links = tokens.links
  for (const token of tokens) {
    if (token.type === 'code' && token.lang?.trim() === 'mermaid') {
      flush()
      parts.push({ kind: 'diagram', content: token.text })
      pending.links = tokens.links
    } else pending.push(token)
  }
  flush()
  return parts
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
