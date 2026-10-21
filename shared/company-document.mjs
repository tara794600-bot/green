import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { isImageUrl } from './company-document-schema.mjs'
export * from './company-document-schema.mjs'

// 편집기 글꼴 목록입니다. 본문에서 사용한 글꼴만 상세페이지에서 불러오며, 정제 규칙도 이 목록만 허용합니다.
export const documentFonts = [
  { label: '나눔고딕', family: 'Nanum Gothic', fallback: 'sans-serif', weights: '400;700;800' },
  { label: '나눔명조', family: 'Nanum Myeongjo', fallback: 'serif', weights: '400;700;800' },
  { label: '나눔손글씨 펜', family: 'Nanum Pen Script', fallback: 'cursive' },
  { label: '나눔손글씨 붓', family: 'Nanum Brush Script', fallback: 'cursive' },
  { label: '고운돋움', family: 'Gowun Dodum', fallback: 'sans-serif' },
  { label: '고운바탕', family: 'Gowun Batang', fallback: 'serif', weights: '400;700' },
  { label: '도현', family: 'Do Hyeon', fallback: 'sans-serif' },
  { label: '주아', family: 'Jua', fallback: 'sans-serif' },
  // 사이트 기본 글꼴이라 별도 로딩이 필요 없습니다.
  { label: '본고딕', family: 'Noto Sans KR', fallback: 'sans-serif', bundled: true },
  { label: '본명조', family: 'Noto Serif KR', fallback: 'serif', bundled: true },
]
export function fontStylesheet(html) {
  const used = documentFonts.filter((f) => !f.bundled && html.includes(f.family))
  if (!used.length) return ''
  const families = used.map(
    (f) => 'family=' + f.family.replaceAll(' ', '+') + (f.weights ? ':wght@' + f.weights : ''),
  )
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

// 편집기 미리보기와 SSR에서 같은 HTML 허용 목록을 사용합니다.
// 스크립트·이벤트·자유로운 위치 지정은 제외하고 본문 표현에 필요한 태그·속성·스타일만 허용합니다.
const cssColor = /^(?:#[\da-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/i
const size = /^(?:0|\d{1,3}(?:\.\d+)?(?:px|em|rem|%))$/
const fontFamily = new RegExp(
  `^["']?(?:${documentFonts.map((f) => f.family).join('|')})["']?(?:,\\s*(?:sans-serif|serif|cursive|monospace))?$`,
)
const youtubeEmbed = /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[\w-]{6,20}(?:\?[\w=&%.-]*)?$/
const dataAttributes = ['data-type', 'data-style', 'data-align', 'data-size', 'data-layout']
export function sanitizeContent(html, { localImages = false } = {}) {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img',
      'del',
      'details',
      'summary',
      'input',
      'label',
      'iframe',
    ],
    allowedAttributes: {
      '*': ['style', 'class', 'title', ...dataAttributes],
      a: ['href', 'title', 'target', 'rel', ...dataAttributes],
      img: ['src', 'alt', 'title', 'loading'],
      input: ['type', 'checked', 'disabled'],
      li: ['data-type', 'data-checked', 'style'],
      mark: ['data-color', 'style'],
      time: ['datetime'],
      td: ['colspan', 'rowspan', 'colwidth', 'style'],
      th: ['colspan', 'rowspan', 'colwidth', 'style'],
      div: ['data-youtube-video', 'style', 'class', ...dataAttributes],
      iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy', 'title'],
    },
    allowedClasses: {
      '*': ['doc-highlight', 'doc-number', 'doc-box', 'doc-fade', 'doc-pulse', 'doc-float', 'tableWrapper'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: { img: localImages ? ['https', 'blob'] : ['https'], iframe: ['https'] },
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com'],
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        color: [cssColor],
        'background-color': [cssColor],
        'border-color': [cssColor],
        'font-family': [fontFamily],
        'font-size': [/^(?:\d|[1-6]\d|7[0-2])px$/, /^[0-3](?:\.\d+)?(?:em|rem)$/],
        'font-weight': [/^(?:normal|bold|[1-9]00)$/],
        'font-style': [/^(?:normal|italic)$/],
        'line-height': [/^(?:[0-3](?:\.\d{1,2})?|[1-3]\d{2}%)$/],
        'letter-spacing': [/^(?:normal|-?(?:0|0?\.\d{1,3}|[1-3](?:\.\d{1,2})?)(?:em|px))$/],
        'text-align': [/^(?:left|center|right|justify)$/],
        'text-decoration': [/^(?:underline|line-through|none)$/],
        'border-radius': [size],
        padding: [size],
        margin: [size],
        width: [/^\d{1,4}(?:\.\d+)?(?:px|%)$/],
        'min-width': [/^\d{1,4}(?:\.\d+)?px$/],
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
          src:
            isImageUrl(attribs.src || '') || (localImages && /^blob:/.test(attribs.src || ''))
              ? attribs.src
              : '',
          loading: 'lazy',
        },
      }),
      // 동영상은 YouTube 퍼가기 주소만 허용하고, 재생에 필요한 속성은 서버가 고정값으로 다시 씁니다.
      iframe: (tagName, attribs) =>
        youtubeEmbed.test(attribs.src || '')
          ? {
              tagName,
              attribs: {
                src: attribs.src,
                width: '640',
                height: '360',
                title: 'YouTube 동영상',
                loading: 'lazy',
                referrerpolicy: 'strict-origin-when-cross-origin',
                allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                allowfullscreen: '',
              },
            }
          : { tagName: 'span', attribs: {} },
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  })
}

const escape = (text) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
const markdown = (source) => marked.parse(source, { async: false, gfm: true, breaks: true })
// 이전 블록 문서를 편집기 HTML로 옮깁니다. 블록 단위로 정제해 닫히지 않은 태그가 다음 블록을 감싸지 않게 합니다.
function legacyBlockHtml({ type, content, caption, style }) {
  if (type === 'divider') return '<hr data-style="line">'
  if (type === 'mermaid') return `<pre><code>${escape(content)}</code></pre>`
  if (type === 'image')
    return content
      ? `<figure data-type="image" data-align="center" data-size="full"><img src="${escape(content)}" alt="${escape(caption)}">${caption ? `<figcaption>${escape(caption)}</figcaption>` : ''}</figure>`
      : ''
  if (type === 'stat')
    return (
      `<p style="text-align: center"><span style="font-size: 38px; color: ${escape(style.accent)}"><strong>${escape(content)}</strong></span></p>` +
      (caption ? `<p style="text-align: center">${escape(caption)}</p>` : '')
    )
  const html = sanitizeContent(type === 'html' ? content : markdown(content))
  return type === 'callout' ? `<blockquote data-style="postit">${html}</blockquote>` : html
}
export function documentHtml(document) {
  if (!document) return ''
  if ('html' in document) return document.html
  return document.blocks.map(legacyBlockHtml).join('')
}
// 빈 문단만 남은 본문은 상세페이지에 본문 영역을 만들지 않습니다.
export function hasDocumentContent(document) {
  const html = documentHtml(document)
  return /<(?:img|iframe|hr|table)\b/i.test(html) || /\S/.test(html.replace(/<[^>]*>|&nbsp;/g, ''))
}
