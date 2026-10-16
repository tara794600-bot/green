import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { isImageUrl } from './company-document-schema.mjs'
export * from './company-document-schema.mjs'

// 편집기 미리보기와 SSR에서 같은 HTML 허용 목록을 사용합니다.
// 스크립트·이벤트·자유로운 위치 지정은 제외하고 본문 표현에 필요한 스타일만 허용합니다.
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

// Mermaid 코드 블록만 별도 렌더러로 넘기고 나머지는 정제된 HTML 조각으로 반환합니다.
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
  // 다이어그램 경계에서 토큰을 나눠도 참조형 링크가 유지되도록 링크 테이블을 이어받습니다.
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
