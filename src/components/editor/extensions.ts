import { Extension, Node, mergeAttributes } from '@tiptap/core'
import type { DOMOutputSpec } from '@tiptap/pm/model'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { isImageUrl } from '../../../shared/company-document.mjs'
import { CardView, GalleryView, ImageView } from './NodeViews'
import { hostOf, scheduleLabel } from './options'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blogFormatting: {
      setParagraphLineHeight: (lineHeight: string | null) => ReturnType
      setLetterSpacing: (letterSpacing: string | null) => ReturnType
    }
  }
}

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T) =>
  allowed.includes(value as T) ? (value as T) : fallback
// 붙여넣은 HTML의 data:·비보안 주소 이미지는 버립니다. blob:은 저장 전 업로드할 편집기 미리보기 주소입니다.
export const acceptableImage = (src: string | null | undefined): src is string =>
  Boolean(src) && (isImageUrl(src!) || src!.startsWith('blob:'))
const text = (el: HTMLElement, selector: string) => el.querySelector(selector)?.textContent?.trim() || ''

// 줄간격(문단 단위)·자간(글자 단위)·인용구/구분선 모양·표 셀 배경을 기존 노드에 속성으로 더합니다.
export const BlogFormatting = Extension.create({
  name: 'blogFormatting',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (a) => (a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {}),
          },
        },
      },
      {
        types: ['textStyle'],
        attributes: {
          letterSpacing: {
            default: null,
            parseHTML: (el) => el.style.letterSpacing || null,
            renderHTML: (a) => (a.letterSpacing ? { style: `letter-spacing: ${a.letterSpacing}` } : {}),
          },
        },
      },
      {
        types: ['blockquote'],
        attributes: {
          variant: {
            default: 'line',
            parseHTML: (el) =>
              pick(
                el.getAttribute('data-style'),
                ['quotation', 'line', 'bubble', 'underline', 'postit', 'frame'],
                'line',
              ),
            renderHTML: (a) => ({ 'data-style': a.variant }),
          },
        },
      },
      {
        types: ['horizontalRule'],
        attributes: {
          variant: {
            default: 'line',
            parseHTML: (el) =>
              pick(
                el.getAttribute('data-style'),
                ['line', 'thick', 'double', 'dashed', 'dotted', 'short', 'dots', 'diamond'],
                'line',
              ),
            renderHTML: (a) => ({ 'data-style': a.variant }),
          },
        },
      },
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          background: {
            default: null,
            parseHTML: (el) => el.style.backgroundColor || null,
            renderHTML: (a) => (a.background ? { style: `background-color: ${a.background}` } : {}),
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setParagraphLineHeight:
        (lineHeight) =>
        ({ commands }) =>
          [
            commands.updateAttributes('paragraph', { lineHeight }),
            commands.updateAttributes('heading', { lineHeight }),
          ].some(Boolean),
      setLetterSpacing:
        (letterSpacing) =>
        ({ chain }) =>
          letterSpacing
            ? chain().setMark('textStyle', { letterSpacing }).run()
            : chain().setMark('textStyle', { letterSpacing: null }).removeEmptyTextStyle().run(),
    }
  },
})

// 사진 한 장: 크기(작게·중간·문서 너비)와 정렬, 사진 설명을 가집니다.
export const BlogImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '', rendered: false },
      alt: { default: '', rendered: false },
      caption: { default: '', rendered: false },
      align: {
        default: 'center',
        parseHTML: (el) => pick(el.getAttribute('data-align'), ['left', 'center', 'right'], 'center'),
        renderHTML: (a) => ({ 'data-align': a.align }),
      },
      size: {
        default: 'full',
        parseHTML: (el) => pick(el.getAttribute('data-size'), ['small', 'medium', 'full'], 'full'),
        renderHTML: (a) => ({ 'data-size': a.size }),
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-type="image"]',
        getAttrs: (el) => {
          const img = el.querySelector('img')
          const src = img?.getAttribute('src')
          return acceptableImage(src)
            ? { src, alt: img?.getAttribute('alt') || '', caption: text(el, 'figcaption') }
            : false
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (el) => {
          const src = el.getAttribute('src')
          return acceptableImage(src) ? { src, alt: el.getAttribute('alt') || '' } : false
        },
      },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    const { src, alt, caption } = node.attrs
    return [
      'figure',
      mergeAttributes({ 'data-type': 'image' }, HTMLAttributes),
      ['img', { src, alt: alt || caption }],
      ...(caption ? [['figcaption', {}, caption]] : []),
    ] as DOMOutputSpec
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})

// 사진 묶음: 여러 장을 격자(콜라주) 또는 옆으로 넘기는 슬라이드로 보여줍니다.
export const BlogGallery = Node.create({
  name: 'gallery',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      images: { default: [], rendered: false },
      caption: { default: '', rendered: false },
      layout: {
        default: 'collage',
        parseHTML: (el) => pick(el.getAttribute('data-layout'), ['collage', 'slide'], 'collage'),
        renderHTML: (a) => ({ 'data-layout': a.layout }),
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-type="gallery"]',
        getAttrs: (el) => {
          const images = [...el.querySelectorAll('img')]
            .map((img) => ({ src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '' }))
            .filter((img) => acceptableImage(img.src))
          return images.length ? { images, caption: text(el, 'figcaption') } : false
        },
      },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    const { images, caption } = node.attrs as { images: { src: string; alt: string }[]; caption: string }
    return [
      'figure',
      mergeAttributes({ 'data-type': 'gallery' }, HTMLAttributes),
      ['div', {}, ...images.map((img) => ['img', { src: img.src, alt: img.alt || caption }])],
      ...(caption ? [['figcaption', {}, caption]] : []),
    ] as DOMOutputSpec
  },
  addNodeView() {
    return ReactNodeViewRenderer(GalleryView)
  },
})

const card = (name: string, attrs: string[]) => ({
  name,
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return Object.fromEntries(attrs.map((key) => [key, { default: '', rendered: false }]))
  },
  addNodeView() {
    return ReactNodeViewRenderer(CardView)
  },
})
const external = { target: '_blank', rel: 'noopener noreferrer' }

// 링크 카드: 주소와 제목·설명을 카드로 보여줍니다. 외부 사이트 정보는 서버에서 가져오지 않고 직접 입력합니다.
export const LinkCard = Node.create({
  ...card('linkCard', ['url', 'title', 'description']),
  parseHTML() {
    return [
      {
        tag: 'a[data-type="linkCard"]',
        priority: 1000,
        getAttrs: (el) => ({
          url: el.getAttribute('href') || '',
          title: text(el, 'strong'),
          description: text(el, 'span'),
        }),
      },
    ]
  },
  renderHTML({ node }) {
    const { url, title, description } = node.attrs
    return [
      'a',
      { 'data-type': 'linkCard', href: url, ...external },
      ['strong', {}, title || hostOf(url)],
      ...(description ? [['span', {}, description]] : []),
      ['small', {}, hostOf(url)],
    ] as DOMOutputSpec
  },
})

// 장소: 이름·주소와 네이버 지도 검색 링크를 보여줍니다.
export const Place = Node.create({
  ...card('place', ['name', 'address']),
  parseHTML() {
    return [
      {
        tag: 'div[data-type="place"]',
        getAttrs: (el) => ({ name: text(el, 'strong'), address: text(el, 'span') }),
      },
    ]
  },
  renderHTML({ node }) {
    const { name, address } = node.attrs
    return [
      'div',
      { 'data-type': 'place' },
      ['strong', {}, name],
      ...(address ? [['span', {}, address]] : []),
      [
        'a',
        { href: `https://map.naver.com/p/search/${encodeURIComponent(address || name)}`, ...external },
        '네이버 지도에서 보기',
      ],
    ] as DOMOutputSpec
  },
})

// 일정: 날짜·시간과 제목, 장소를 카드로 보여줍니다.
export const Schedule = Node.create({
  ...card('schedule', ['title', 'date', 'time', 'location']),
  parseHTML() {
    return [
      {
        tag: 'div[data-type="schedule"]',
        getAttrs: (el) => {
          const [date = '', time = ''] = (el.querySelector('time')?.getAttribute('datetime') || '').split('T')
          return { title: text(el, 'strong'), location: text(el, 'span'), date, time }
        },
      },
    ]
  },
  renderHTML({ node }) {
    const { title, date, time, location } = node.attrs
    return [
      'div',
      { 'data-type': 'schedule' },
      ['time', { datetime: time ? `${date}T${time}` : date }, scheduleLabel(date, time)],
      ['strong', {}, title],
      ...(location ? [['span', {}, location]] : []),
    ] as DOMOutputSpec
  },
})
