import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { isImageUrl } from './company-document-schema.mjs'
export * from './company-document-schema.mjs'

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
