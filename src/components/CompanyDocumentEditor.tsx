import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import type { Command, Content } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { TableKit } from '@tiptap/extension-table'
import Youtube, { isValidYoutubeUrl } from '@tiptap/extension-youtube'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  CalendarDays,
  ChevronDown,
  Code2,
  Eye,
  Highlighter,
  ImagePlus,
  Italic,
  LayoutTemplate,
  Link,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MapPin,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  PaintBucket,
  Quote,
  Redo2,
  RemoveFormatting,
  SeparatorHorizontal,
  Smile,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table2,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
  Underline,
  Undo2,
  UnfoldVertical,
  Video,
} from 'lucide-react'
import {
  MAX_DOCUMENT_HTML,
  MAX_DOCUMENT_IMAGES,
  documentFonts,
  documentHtml,
  fontStylesheet,
  type CompanyDocument,
  type HtmlCompanyDocument,
} from '../../shared/company-document.mjs'
import {
  clearDocumentDraft,
  readDocumentDraft,
  withoutLocalImages,
  writeDocumentDraft,
} from '../lib/company-document'
import CompanyDocumentView from './CompanyDocument'
import { BlogFormatting, BlogGallery, BlogImage, LinkCard, Place, Schedule } from './editor/extensions'
import { CardForm } from './editor/NodeViews'
import {
  cardLabels,
  dividerStyles,
  emojis,
  fontSizes,
  highlightColors,
  letterSpacings,
  lineHeights,
  normalizeUrl,
  quoteStyles,
  symbols,
  templates,
  textColors,
  type QuoteStyle,
} from './editor/options'
import './company-document-editor.css'

const imageTypes = ['image/png', 'image/jpeg', 'image/webp']
const allFonts = fontStylesheet(documentFonts.map((f) => f.family).join(' '))
const filesEvent = 'se-image-files'
const imageFiles = (data: DataTransfer | null) =>
  [...(data?.files || [])].filter((f) => f.type.startsWith('image/'))
// 붙여넣기·끌어다 놓기로 들어온 사진은 편집기 바깥으로 이벤트를 올려 사진 버튼과 같은 흐름으로 처리합니다.
const sendFiles = (dom: HTMLElement, files: File[]) =>
  dom.dispatchEvent(new CustomEvent(filesEvent, { detail: files, bubbles: true }))
const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
    },
    dropcursor: { color: '#59754a', width: 2 },
  }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
    alignments: ['left', 'center', 'right', 'justify'],
  }),
  Subscript,
  Superscript,
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: true, renderWrapper: true } }),
  Youtube.configure({ nocookie: true, width: 640, height: 360 }),
  Placeholder.configure({ placeholder: '내용을 입력하세요. 사진은 끌어다 놓거나 붙여넣어도 됩니다.' }),
  CharacterCount,
  BlogFormatting,
  BlogImage,
  BlogGallery,
  LinkCard,
  Place,
  Schedule,
]
// 선택한 사진·카드 위에 새 요소를 넣으면 기존 요소가 지워지므로, 먼저 그 뒤에 빈 줄을 만들어 커서를 옮깁니다.
const leaveSelectedNode: Command = ({ tr, state }) => {
  if (!(tr.selection instanceof NodeSelection)) return true
  const pos = tr.selection.to
  const next = tr.doc.resolve(pos).nodeAfter
  // 바로 뒤에 빈 줄이 있으면 그 줄을 써서 빈 줄이 쌓이지 않게 합니다.
  if (!next?.isTextblock || next.content.size) tr.insert(pos, state.schema.nodes.paragraph.create())
  tr.setSelection(TextSelection.create(tr.doc, pos + 1))
  return true
}
// 사진·구분선 같은 블록을 넣은 뒤에는 다음 줄로 커서를 옮겨 바로 이어 쓸 수 있게 합니다.
const continueAfterNode: Command = ({ tr, state }) => {
  if (!(tr.selection instanceof NodeSelection)) return true
  const pos = tr.selection.to
  if (!tr.doc.resolve(pos).nodeAfter?.isTextblock) tr.insert(pos, state.schema.nodes.paragraph.create())
  tr.setSelection(TextSelection.create(tr.doc, pos + 1))
  return true
}
function imageCount(editor: Editor) {
  let count = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image') count += 1
    if (node.type.name === 'gallery') count += node.attrs.images.length
  })
  return count
}
const time = (value: number) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
  className = '',
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={`se-tool ${active ? 'is-active' : ''} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// 툴바 펼침 메뉴입니다. 버튼은 편집기 포커스를 빼앗지 않아 선택한 글자에 바로 서식을 적용합니다.
function Dropdown({
  title,
  button,
  className = '',
  align,
  children,
}: {
  title: string
  button: ReactNode
  className?: string
  align?: 'end'
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    // 메뉴만 닫고 관리자 창은 그대로 둡니다.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open])
  return (
    <div className={`se-dropdown ${className}`} ref={root}>
      <button
        type="button"
        className={`se-tool ${open ? 'is-open' : ''}`}
        title={title}
        aria-label={title}
        aria-expanded={open}
        aria-haspopup="true"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        {button}
        <ChevronDown size={11} className="se-caret" />
      </button>
      {open && (
        <div className={`se-popover ${align === 'end' ? 'is-end' : ''}`} aria-label={title}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function Palette({
  rows,
  value,
  resetLabel,
  onPick,
}: {
  rows: string[][]
  value: string
  resetLabel: string
  onPick: (color: string | null) => void
}) {
  return (
    <div className="se-palette">
      {rows.map((row, i) => (
        <div key={i}>
          {row.map((color) => (
            <button
              type="button"
              key={color}
              className={value.toLowerCase() === color ? 'is-active' : ''}
              style={{ background: color }}
              title={color}
              aria-label={`색상 ${color}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(color)}
            />
          ))}
        </div>
      ))}
      <div className="se-palette-foot">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(null)}>
          {resetLabel}
        </button>
        <label>
          직접 선택
          <input
            type="color"
            aria-label="직접 색상 선택"
            value={/^#[\da-f]{6}$/i.test(value) ? value : '#000000'}
            onChange={(e) => onPick(e.target.value)}
          />
        </label>
      </div>
    </div>
  )
}

function OptionList<T extends string>({
  options,
  value,
  onPick,
  render,
}: {
  options: readonly (readonly [T, string])[]
  value: string
  onPick: (value: T) => void
  render?: (value: T, label: string) => ReactNode
}) {
  return (
    <div className="se-options" role="menu">
      {options.map(([key, label]) => (
        <button
          type="button"
          role="menuitemradio"
          aria-checked={value === key}
          key={key || 'default'}
          className={value === key ? 'is-active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(key)}
        >
          {render ? render(key, label) : label}
        </button>
      ))}
    </div>
  )
}

// 짧은 주소 입력 창입니다. 엔터는 바깥 저장 폼을 제출하지 않고 이 창의 적용 버튼으로 처리합니다.
function UrlForm({
  label,
  initial = '',
  placeholder,
  submitLabel,
  onSubmit,
  extra,
}: {
  label: string
  initial?: string
  placeholder: string
  submitLabel: string
  onSubmit: (url: string) => string | void
  extra?: ReactNode
}) {
  const [url, setUrl] = useState(initial)
  const [error, setError] = useState('')
  const submit = () => setError(onSubmit(url.trim()) || '')
  return (
    <div
      className="se-form"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          submit()
        }
      }}
    >
      <label>
        {label}
        <input autoFocus value={url} placeholder={placeholder} onChange={(e) => setUrl(e.target.value)} />
      </label>
      {error && (
        <p className="se-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="se-form-actions">
        {extra}
        <button type="button" className="primary" onClick={submit}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function TablePicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ rows: 3, cols: 3 })
  return (
    <div className="se-table-picker">
      <div onMouseLeave={() => setHover({ rows: 3, cols: 3 })}>
        {Array.from({ length: 48 }, (_, i) => {
          const rows = Math.floor(i / 8) + 1,
            cols = (i % 8) + 1
          return (
            <button
              type="button"
              key={i}
              aria-label={`${rows}행 ${cols}열 표 넣기`}
              className={rows <= hover.rows && cols <= hover.cols ? 'is-active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHover({ rows, cols })}
              onFocus={() => setHover({ rows, cols })}
              onClick={() => onPick(rows, cols)}
            />
          )
        })}
      </div>
      <p>
        {hover.rows} × {hover.cols} 표
      </p>
    </div>
  )
}

function CharacterPicker({ onPick }: { onPick: (text: string) => void }) {
  const [tab, setTab] = useState<'emoji' | 'symbol'>('emoji')
  return (
    <div className="se-characters">
      <div className="se-tabs" role="tablist">
        {(
          [
            ['emoji', '이모지'],
            ['symbol', '특수문자'],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            role="tab"
            key={key}
            aria-selected={tab === key}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="se-character-grid">
        {(tab === 'emoji' ? emojis : symbols).map((char) => (
          <button
            type="button"
            key={char}
            aria-label={`${char} 넣기`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(char)}
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function CompanyDocumentEditor({
  value,
  onChange,
  onImageFile,
  draftKey,
}: {
  value: CompanyDocument
  onChange: (value: HtmlCompanyDocument) => void
  onImageFile: (file: File) => string
  draftKey: string
}) {
  // 이전 블록 형식 본문도 HTML로 바꿔 엽니다. 이후 변경은 편집기가 상위 상태로 전달합니다.
  const [initialHtml] = useState(() => documentHtml(value))
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const [preview, setPreview] = useState<{ mode: 'pc' | 'mobile'; html: string } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [draft, setDraft] = useState(() => {
    const saved = readDocumentDraft(draftKey)
    return saved && saved.html !== initialHtml ? saved : null
  })
  const [savedAt, setSavedAt] = useState(0)
  const [htmlLength, setHtmlLength] = useState(initialHtml.length)
  const root = useRef<HTMLElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const draftTimer = useRef(0)
  const latest = useRef({ onChange, draftKey })
  useEffect(() => {
    latest.current = { onChange, draftKey }
  })
  const editor = useEditor({
    extensions,
    content: initialHtml,
    editorProps: {
      attributes: { class: 'se-content', 'aria-label': '본문 입력', spellcheck: 'true' },
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData)
        // 웹페이지에서 복사한 글과 사진은 HTML로 붙여넣고, 캡처처럼 파일만 있을 때 사진으로 넣습니다.
        if (!files.length || event.clipboardData?.getData('text/html')) return false
        sendFiles(view.dom, files)
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = imageFiles(event.dataTransfer)
        if (moved || !files.length) return false
        event.preventDefault()
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (at) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(at.pos))))
        sendFiles(view.dom, files)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      setHtmlLength(html.length)
      latest.current.onChange({ version: 2, html })
      window.clearTimeout(draftTimer.current)
      draftTimer.current = window.setTimeout(() => {
        if (writeDocumentDraft(latest.current.draftKey, html)) setSavedAt(Date.now())
      }, 1000)
    },
  })
  useEffect(() => () => window.clearTimeout(draftTimer.current), [])
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const text = e.getAttributes('textStyle')
      return {
        heading: ([1, 2, 3] as const).find((level) => e.isActive('heading', { level })) ?? 0,
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        superscript: e.isActive('superscript'),
        subscript: e.isActive('subscript'),
        fontFamily: String(text.fontFamily || ''),
        fontSize: String(text.fontSize || ''),
        color: String(text.color || ''),
        letterSpacing: String(text.letterSpacing || ''),
        highlight: String(e.getAttributes('highlight').color || ''),
        align: (['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
        lineHeight: String(
          e.getAttributes('paragraph').lineHeight || e.getAttributes('heading').lineHeight || '',
        ),
        quote: e.isActive('blockquote') ? String(e.getAttributes('blockquote').variant) : '',
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        taskList: e.isActive('taskList'),
        codeBlock: e.isActive('codeBlock'),
        link: String(e.getAttributes('link').href || ''),
        table: e.isActive('table'),
        cellBackground: String(
          e.getAttributes('tableCell').background || e.getAttributes('tableHeader').background || '',
        ),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        // 개발 모드에서 편집기를 다시 만드는 순간에는 저장소가 비어 있을 수 있습니다.
        characters: e.storage.characterCount?.characters() ?? 0,
        withoutSpaces: e.state.doc.textContent.replace(/\s/g, '').length,
      }
    },
  })

  function addFiles(files: File[]) {
    const valid = files.filter((f) => imageTypes.includes(f.type) && f.size <= 10 * 1024 * 1024)
    const room = Math.max(0, MAX_DOCUMENT_IMAGES - imageCount(editor))
    const accepted = valid.slice(0, room)
    setNotice(
      [
        valid.length < files.length && 'JPG · PNG · WebP 형식의 10MB 이하 사진만 넣을 수 있습니다.',
        accepted.length < valid.length && `본문 사진은 최대 ${MAX_DOCUMENT_IMAGES}장까지 넣을 수 있습니다.`,
      ]
        .filter(Boolean)
        .join(' '),
    )
    const urls = accepted.map(onImageFile)
    if (urls.length === 1) insertImages(urls, 'single')
    else if (urls.length) setPending(urls)
  }
  const handleFiles = useRef(addFiles)
  useEffect(() => {
    handleFiles.current = addFiles
  })
  useEffect(() => {
    const section = root.current
    const listener = (e: Event) => handleFiles.current((e as CustomEvent<File[]>).detail)
    section?.addEventListener(filesEvent, listener)
    return () => section?.removeEventListener(filesEvent, listener)
  }, [])
  function insertImages(urls: string[], layout: 'single' | 'collage' | 'slide') {
    insert(
      layout === 'single'
        ? urls.map((src) => ({ type: 'image', attrs: { src } }))
        : { type: 'gallery', attrs: { layout, images: urls.map((src) => ({ src, alt: '' })) } },
    )
    setPending([])
  }
  function applyQuote(variant: QuoteStyle) {
    const chain = editor.chain().focus()
    if (state.quote === variant) chain.unsetBlockquote().run()
    else if (state.quote) chain.updateAttributes('blockquote', { variant }).run()
    else chain.setBlockquote().updateAttributes('blockquote', { variant }).run()
  }
  function insert(content: Content) {
    editor.chain().focus().command(leaveSelectedNode).insertContent(content).command(continueAfterNode).run()
  }
  function setLink(input: string) {
    const href = normalizeUrl(input, { contact: true })
    if (!href) return 'http(s) 주소, mailto: 또는 tel: 주소를 입력해 주세요.'
    if (editor.state.selection.empty && !state.link)
      editor
        .chain()
        .focus()
        .command(leaveSelectedNode)
        .insertContent({ type: 'text', text: input, marks: [{ type: 'link', attrs: { href } }] })
        .run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }
  function restoreDraft() {
    if (!draft) return
    const { html, removed } = withoutLocalImages(draft.html)
    editor.commands.setContent(html, { emitUpdate: true })
    setDraft(null)
    setNotice(
      removed
        ? `임시저장한 글을 불러왔습니다. 업로드 전이던 사진 ${removed}장은 다시 넣어 주세요.`
        : '임시저장한 글을 불러왔습니다.',
    )
  }

  const run = () => editor.chain().focus()
  const fontLabel = documentFonts.find((f) => state.fontFamily.includes(f.family))?.label || '기본서체'
  const AlignIcon =
    { center: AlignCenter, right: AlignRight, justify: AlignJustify }[state.align as string] || AlignLeft
  const overLimit = htmlLength > MAX_DOCUMENT_HTML
  return (
    <section
      ref={root}
      className={`se-editor ${fullscreen ? 'is-fullscreen' : ''}`}
      aria-label="상세 본문 편집기"
      // 편집 중 Esc로 관리자 창이 닫혀 작성 내용을 잃지 않게 합니다.
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.preventDefault()
      }}
    >
      <link rel="stylesheet" href={allFonts} precedence="default" />
      <div className="se-head">
        <div>
          <span className="se-kicker">SMART EDITOR</span>
          <h3>상세 본문</h3>
          <p>사진, 인용구, 글자 색과 형광펜으로 읽기 쉬운 안내를 작성하세요.</p>
        </div>
        <div className="se-head-actions">
          <button
            type="button"
            className="se-head-button"
            aria-pressed={Boolean(preview)}
            onClick={() => setPreview(preview ? null : { mode: 'pc', html: editor.getHTML() })}
          >
            <Eye size={15} />
            {preview ? '편집으로 돌아가기' : '미리보기'}
          </button>
          <button type="button" className="se-head-button" onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {fullscreen ? '창 크기로' : '넓게 쓰기'}
          </button>
        </div>
      </div>
      {draft && (
        <div className="se-draft" role="status">
          <span>{time(draft.savedAt)}에 임시저장한 글이 있습니다.</span>
          <button type="button" onClick={restoreDraft}>
            불러오기
          </button>
          <button
            type="button"
            onClick={() => {
              clearDocumentDraft(draftKey)
              setDraft(null)
            }}
          >
            삭제
          </button>
        </div>
      )}
      <div className="se-toolbar" role="toolbar" aria-label="본문 서식" hidden={Boolean(preview)}>
        <div className="se-components">
          <ToolButton label="사진" className="se-component" onClick={() => fileInput.current?.click()}>
            <ImagePlus size={20} />
            <span>사진</span>
          </ToolButton>
          <Dropdown
            title="동영상"
            className="se-component"
            button={
              <>
                <Video size={20} />
                <span>동영상</span>
              </>
            }
          >
            {(close) => (
              <UrlForm
                label="YouTube 주소"
                placeholder="https://www.youtube.com/watch?v=…"
                submitLabel="동영상 넣기"
                onSubmit={(src) => {
                  if (!isValidYoutubeUrl(src)) return 'YouTube 동영상 주소를 확인해 주세요.'
                  run().command(leaveSelectedNode).setYoutubeVideo({ src }).command(continueAfterNode).run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <Dropdown
            title="인용구"
            className="se-component"
            button={
              <>
                <Quote size={20} />
                <span>인용구</span>
              </>
            }
          >
            {(close) => (
              <OptionList
                options={quoteStyles}
                value={state.quote}
                onPick={(variant) => {
                  applyQuote(variant)
                  close()
                }}
                render={(key, label) => (
                  <>
                    <span className="se-swatch-quote" data-style={key} aria-hidden="true" />
                    {label}
                  </>
                )}
              />
            )}
          </Dropdown>
          <Dropdown
            title="구분선"
            className="se-component"
            button={
              <>
                <SeparatorHorizontal size={20} />
                <span>구분선</span>
              </>
            }
          >
            {(close) => (
              <OptionList
                options={dividerStyles}
                value=""
                onPick={(variant) => {
                  insert({ type: 'horizontalRule', attrs: { variant } })
                  close()
                }}
                render={(key, label) => (
                  <span className="se-swatch-divider se-content">
                    <hr data-style={key} aria-hidden="true" />
                    <small>{label}</small>
                  </span>
                )}
              />
            )}
          </Dropdown>
          {(
            [
              ['place', MapPin],
              ['linkCard', Link2],
              ['schedule', CalendarDays],
            ] as const
          ).map(([type, Icon]) => (
            <Dropdown
              key={type}
              title={cardLabels[type]}
              className="se-component"
              button={
                <>
                  <Icon size={20} />
                  <span>{cardLabels[type]}</span>
                </>
              }
            >
              {(close) => (
                <CardForm
                  type={type}
                  submitLabel={`${cardLabels[type]} 넣기`}
                  onCancel={close}
                  onSubmit={(attrs) => {
                    insert({ type, attrs })
                    close()
                  }}
                />
              )}
            </Dropdown>
          ))}
          <Dropdown
            title="표"
            className="se-component"
            button={
              <>
                <Table2 size={20} />
                <span>표</span>
              </>
            }
          >
            {(close) => (
              <TablePicker
                onPick={(rows, cols) => {
                  run().command(leaveSelectedNode).insertTable({ rows, cols, withHeaderRow: true }).run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <ToolButton
            label="소스코드"
            className="se-component"
            active={state.codeBlock}
            onClick={() => run().toggleCodeBlock().run()}
          >
            <Code2 size={20} />
            <span>소스코드</span>
          </ToolButton>
          <Dropdown
            title="이모티콘"
            className="se-component"
            button={
              <>
                <Smile size={20} />
                <span>이모티콘</span>
              </>
            }
          >
            {() => (
              <CharacterPicker
                onPick={(char) => run().command(leaveSelectedNode).insertContent(char).run()}
              />
            )}
          </Dropdown>
          <Dropdown
            title="템플릿"
            className="se-component"
            align="end"
            button={
              <>
                <LayoutTemplate size={20} />
                <span>템플릿</span>
              </>
            }
          >
            {(close) => (
              <div className="se-templates">
                {templates.map((t) => (
                  <button
                    type="button"
                    key={t.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (editor.isEmpty)
                        editor.chain().setContent(t.html, { emitUpdate: true }).focus('end').run()
                      else insert(t.html)
                      close()
                    }}
                  >
                    <strong>{t.name}</strong>
                    <span>{t.description}</span>
                  </button>
                ))}
              </div>
            )}
          </Dropdown>
        </div>
        <div className="se-properties">
          <Dropdown
            title="문단 서식"
            button={<span className="se-label">{state.heading ? `제목 ${state.heading}` : '본문'}</span>}
          >
            {(close) => (
              <OptionList
                options={[
                  ['0', '본문'],
                  ['1', '제목 1'],
                  ['2', '제목 2'],
                  ['3', '제목 3'],
                ]}
                value={String(state.heading)}
                render={(key, label) => <span className={`se-heading-option h${key}`}>{label}</span>}
                onPick={(key) => {
                  if (key === '0') run().setParagraph().run()
                  else
                    run()
                      .setHeading({ level: Number(key) as 1 | 2 | 3 })
                      .run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <Dropdown title="글꼴" button={<span className="se-label se-font-label">{fontLabel}</span>}>
            {(close) => (
              <OptionList
                options={[
                  ['', '기본서체'],
                  ...documentFonts.map((f) => [`'${f.family}', ${f.fallback}`, f.label] as const),
                ]}
                value={documentFonts.find((f) => state.fontFamily.includes(f.family)) ? state.fontFamily : ''}
                render={(key, label) => <span style={{ fontFamily: key || undefined }}>{label}</span>}
                onPick={(key) => {
                  if (key) run().setFontFamily(key).run()
                  else run().unsetFontFamily().run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <Dropdown
            title="글자 크기"
            button={<span className="se-label">{parseInt(state.fontSize) || 16}</span>}
          >
            {(close) => (
              <OptionList
                options={fontSizes.map((size) => [size, size] as const)}
                value={String(parseInt(state.fontSize) || 16)}
                render={(key) => <span style={{ fontSize: Math.min(Number(key), 24) }}>{key}</span>}
                onPick={(key) => {
                  if (key === '16') run().unsetFontSize().run()
                  else run().setFontSize(`${key}px`).run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <span className="se-divider" />
          <ToolButton label="굵게" active={state.bold} onClick={() => run().toggleBold().run()}>
            <Bold size={17} />
          </ToolButton>
          <ToolButton label="기울임" active={state.italic} onClick={() => run().toggleItalic().run()}>
            <Italic size={17} />
          </ToolButton>
          <ToolButton label="밑줄" active={state.underline} onClick={() => run().toggleUnderline().run()}>
            <Underline size={17} />
          </ToolButton>
          <ToolButton label="취소선" active={state.strike} onClick={() => run().toggleStrike().run()}>
            <Strikethrough size={17} />
          </ToolButton>
          <Dropdown
            title="글자 색"
            button={
              <span className="se-color-icon">
                <Baseline size={17} />
                <i style={{ background: state.color || '#26332c' }} />
              </span>
            }
          >
            {(close) => (
              <Palette
                rows={textColors}
                value={state.color}
                resetLabel="기본 색"
                onPick={(color) => {
                  if (color) run().setColor(color).run()
                  else run().unsetColor().run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <Dropdown
            title="형광펜"
            button={
              <span className="se-color-icon">
                <Highlighter size={17} />
                <i style={{ background: state.highlight || '#fff3a3' }} />
              </span>
            }
          >
            {(close) => (
              <Palette
                rows={highlightColors}
                value={state.highlight}
                resetLabel="형광펜 지우기"
                onPick={(color) => {
                  if (color) run().setHighlight({ color }).run()
                  else run().unsetHighlight().run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <span className="se-divider" />
          <Dropdown title="정렬" button={<AlignIcon size={17} />}>
            {(close) => (
              <OptionList
                options={[
                  ['left', '왼쪽 정렬'],
                  ['center', '가운데 정렬'],
                  ['right', '오른쪽 정렬'],
                  ['justify', '양쪽 정렬'],
                ]}
                value={state.align}
                onPick={(align) => {
                  run().setTextAlign(align).run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <Dropdown title="줄간격" button={<UnfoldVertical size={17} />}>
            {(close) => (
              <OptionList
                options={lineHeights}
                value={state.lineHeight || '1.8'}
                onPick={(value) => {
                  run()
                    .setParagraphLineHeight(value === '1.8' ? null : value)
                    .run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <Dropdown title="자간" button={<MoveHorizontal size={17} />}>
            {(close) => (
              <OptionList
                options={letterSpacings}
                value={state.letterSpacing}
                onPick={(value) => {
                  run()
                    .setLetterSpacing(value || null)
                    .run()
                  close()
                }}
              />
            )}
          </Dropdown>
          <span className="se-divider" />
          <ToolButton
            label="글머리 기호"
            active={state.bulletList}
            onClick={() => run().toggleBulletList().run()}
          >
            <List size={17} />
          </ToolButton>
          <ToolButton
            label="번호 매기기"
            active={state.orderedList}
            onClick={() => run().toggleOrderedList().run()}
          >
            <ListOrdered size={17} />
          </ToolButton>
          <ToolButton label="체크리스트" active={state.taskList} onClick={() => run().toggleTaskList().run()}>
            <ListChecks size={17} />
          </ToolButton>
          <ToolButton
            label="위 첨자"
            active={state.superscript}
            onClick={() => run().toggleSuperscript().run()}
          >
            <SuperscriptIcon size={17} />
          </ToolButton>
          <ToolButton
            label="아래 첨자"
            active={state.subscript}
            onClick={() => run().toggleSubscript().run()}
          >
            <SubscriptIcon size={17} />
          </ToolButton>
          <Dropdown
            title="링크 걸기"
            align="end"
            button={<Link size={17} className={state.link ? 'se-on' : ''} />}
          >
            {(close) => (
              <UrlForm
                key={state.link}
                label="링크 주소"
                initial={state.link}
                placeholder="https:// 또는 mailto:, tel:"
                submitLabel="적용"
                onSubmit={(url) => {
                  const error = setLink(url)
                  if (!error) close()
                  return error
                }}
                extra={
                  state.link && (
                    <button
                      type="button"
                      onClick={() => {
                        run().extendMarkRange('link').unsetLink().run()
                        close()
                      }}
                    >
                      링크 해제
                    </button>
                  )
                }
              />
            )}
          </Dropdown>
          <ToolButton
            label="서식 지우기"
            onClick={() => run().unsetAllMarks().unsetTextAlign().setParagraphLineHeight(null).run()}
          >
            <RemoveFormatting size={17} />
          </ToolButton>
          <span className="se-divider" />
          <ToolButton label="실행 취소" disabled={!state.canUndo} onClick={() => run().undo().run()}>
            <Undo2 size={17} />
          </ToolButton>
          <ToolButton label="다시 실행" disabled={!state.canRedo} onClick={() => run().redo().run()}>
            <Redo2 size={17} />
          </ToolButton>
        </div>
        {state.table && (
          <div className="se-table-tools" aria-label="표 편집">
            <strong>표</strong>
            <ToolButton label="위에 행 추가" onClick={() => run().addRowBefore().run()}>
              <BetweenHorizontalStart size={16} />
            </ToolButton>
            <ToolButton label="아래에 행 추가" onClick={() => run().addRowAfter().run()}>
              <BetweenHorizontalEnd size={16} />
            </ToolButton>
            <ToolButton label="왼쪽에 열 추가" onClick={() => run().addColumnBefore().run()}>
              <BetweenVerticalStart size={16} />
            </ToolButton>
            <ToolButton label="오른쪽에 열 추가" onClick={() => run().addColumnAfter().run()}>
              <BetweenVerticalEnd size={16} />
            </ToolButton>
            <ToolButton label="행 삭제" className="se-text-tool" onClick={() => run().deleteRow().run()}>
              행 삭제
            </ToolButton>
            <ToolButton label="열 삭제" className="se-text-tool" onClick={() => run().deleteColumn().run()}>
              열 삭제
            </ToolButton>
            <ToolButton label="셀 합치기" onClick={() => run().mergeCells().run()}>
              <TableCellsMerge size={16} />
            </ToolButton>
            <ToolButton label="셀 나누기" onClick={() => run().splitCell().run()}>
              <TableCellsSplit size={16} />
            </ToolButton>
            <ToolButton
              label="머리글 행"
              className="se-text-tool"
              onClick={() => run().toggleHeaderRow().run()}
            >
              머리글
            </ToolButton>
            <Dropdown title="셀 배경색" button={<PaintBucket size={16} />}>
              {(close) => (
                <Palette
                  rows={[...highlightColors, textColors[2]]}
                  value={state.cellBackground}
                  resetLabel="배경 없음"
                  onPick={(color) => {
                    run().setCellAttribute('background', color).run()
                    close()
                  }}
                />
              )}
            </Dropdown>
            <ToolButton label="표 삭제" onClick={() => run().deleteTable().run()}>
              <Trash2 size={16} />
            </ToolButton>
          </div>
        )}
      </div>
      {pending.length > 0 && (
        <div className="se-image-choice" role="group" aria-label="사진 넣는 방식">
          <strong>사진 {pending.length}장을 어떻게 넣을까요?</strong>
          <button type="button" onClick={() => insertImages(pending, 'single')}>
            개별 사진
          </button>
          <button type="button" onClick={() => insertImages(pending, 'collage')}>
            콜라주
          </button>
          <button type="button" onClick={() => insertImages(pending, 'slide')}>
            슬라이드
          </button>
          <button type="button" className="se-choice-cancel" onClick={() => setPending([])}>
            취소
          </button>
        </div>
      )}
      <div
        className="se-canvas"
        hidden={Boolean(preview)}
        // 본문 아래 빈 공간을 눌러도 마지막 줄에서 이어 쓸 수 있습니다.
        onMouseDown={(e) => {
          if (e.target !== e.currentTarget) return
          e.preventDefault()
          editor.commands.focus('end')
        }}
      >
        <div className="se-paper">
          <EditorContent editor={editor} />
        </div>
      </div>
      {preview && (
        <div className="se-preview">
          <div className="se-preview-bar" role="group" aria-label="미리보기 화면">
            {(
              [
                ['pc', 'PC'],
                ['mobile', '모바일'],
              ] as const
            ).map(([mode, label]) => (
              <button
                type="button"
                key={mode}
                aria-pressed={preview.mode === mode}
                onClick={() => setPreview({ ...preview, mode })}
              >
                {label}
              </button>
            ))}
            <span>저장하면 상세페이지에 이렇게 표시됩니다.</span>
          </div>
          <div className={`se-preview-frame is-${preview.mode}`}>
            <CompanyDocumentView document={{ version: 2, html: preview.html }} localImages />
          </div>
        </div>
      )}
      <div className="se-footer">
        <span role="status">
          {notice ||
            (savedAt
              ? `${time(savedAt)} 자동 임시저장됨 · 저장하기를 눌러야 상세페이지에 반영됩니다.`
              : '변경사항은 저장하기를 눌러 반영하세요.')}
        </span>
        <span className={overLimit ? 'se-limit-error' : ''}>
          {overLimit
            ? `본문 용량 초과 (${Math.round((htmlLength / MAX_DOCUMENT_HTML) * 100)}%)`
            : `글자수 ${state.characters.toLocaleString()} · 공백 제외 ${state.withoutSpaces.toLocaleString()}`}
        </span>
      </div>
      <input
        ref={fileInput}
        type="file"
        hidden
        multiple
        accept={imageTypes.join(',')}
        aria-label="본문 사진 파일"
        onChange={(e) => {
          addFiles([...(e.target.files || [])])
          e.target.value = ''
        }}
      />
    </section>
  )
}
