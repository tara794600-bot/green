import { useDeferredValue, useRef, useState } from 'react'
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Bold,
  CheckSquare,
  Code2,
  Copy,
  GripVertical,
  Hash,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  Minus,
  Network,
  Plus,
  Quote,
  Redo2,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import {
  MAX_BLOCKS,
  MAX_DOCUMENT_LENGTH,
  blockTypes,
  type BlockStyle,
  type BlockType,
  type CompanyDocument,
  type DocumentBlock,
} from '../../shared/company-document.mjs'
import {
  blockLabels,
  createBlock,
  createTemplate,
  defaultBlockStyle,
  diagramExample,
} from '../lib/company-document'
import CompanyDocumentView, { DocumentBlockView } from './CompanyDocument'
import './company-document-editor.css'

const icons = {
  markdown: Type,
  callout: Square,
  stat: Hash,
  mermaid: Network,
  html: Code2,
  image: ImagePlus,
  divider: Minus,
}
const help = {
  markdown: '제목, 목록, 표, 체크리스트와 링크를 마크다운으로 작성하세요.',
  callout: '중요한 내용을 박스에 담으세요. 마크다운과 HTML을 함께 사용할 수 있습니다.',
  stat: '숫자와 단위를 입력하고, 아래에 의미나 기준일을 적어 주세요.',
  mermaid: 'Mermaid로 흐름도, 순서도, 시퀀스 등을 그리세요. style 구문으로 노드 색상을 바꿀 수 있습니다.',
  html: 'HTML 태그와 인라인 스타일을 사용할 수 있습니다. script, iframe, 이벤트 실행 코드는 제외됩니다.',
  image: '본문에 필요한 이미지를 추가하세요. 캡션은 이미지 대체 텍스트로도 사용됩니다.',
  divider: '문단 사이를 구분하는 선입니다. 강조 색상으로 선 색을 바꿀 수 있습니다.',
}

export default function CompanyDocumentEditor({
  value,
  onChange,
  onImageFile,
}: {
  value: CompanyDocument
  onChange: (value: CompanyDocument) => void
  onImageFile: (file: File) => string
}) {
  const [selected, setSelected] = useState(value.blocks[0]?.id || '')
  const [mode, setMode] = useState<'edit' | 'split' | 'preview'>('split')
  const [menu, setMenu] = useState(false)
  const [past, setPast] = useState<CompanyDocument[]>([])
  const [future, setFuture] = useState<CompanyDocument[]>([])
  const [notice, setNotice] = useState('')
  const dragging = useRef('')
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const selection = useRef({ start: 0, end: 0 })
  const deferred = useDeferredValue(value)
  const active = value.blocks.find((b) => b.id === selected)
  const chars = value.blocks.reduce((sum, b) => sum + b.content.length + b.caption.length, 0)
  function commit(next: CompanyDocument) {
    setPast((items) => [...items.slice(-39), value])
    setFuture([])
    onChange(next)
  }
  function update(id: string, patch: Partial<DocumentBlock>) {
    commit({ ...value, blocks: value.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  }
  function add(type: BlockType) {
    if (value.blocks.length >= MAX_BLOCKS) return
    const block = createBlock(type)
    const replacing = active?.type === 'markdown' && active.content === '/'
    const index = value.blocks.findIndex((b) => b.id === selected)
    const blocks = [...value.blocks]
    if (replacing) blocks.splice(index, 1, block)
    else blocks.splice(index < 0 ? blocks.length : index + 1, 0, block)
    commit({ ...value, blocks })
    setSelected(block.id)
    setMenu(false)
    setNotice(`${blockLabels[type]} 블록을 추가했습니다.`)
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= value.blocks.length || from === to) return
    const blocks = [...value.blocks]
    const [block] = blocks.splice(from, 1)
    blocks.splice(to, 0, block)
    commit({ ...value, blocks })
    setNotice(`${to + 1}번째 위치로 이동했습니다.`)
  }
  function undo() {
    const previous = past.at(-1)
    if (!previous) return
    setFuture((items) => [value, ...items])
    setPast((items) => items.slice(0, -1))
    onChange(previous)
  }
  function redo() {
    if (!future.length) return
    setPast((items) => [...items, value])
    onChange(future[0])
    setFuture((items) => items.slice(1))
  }
  function insert(before: string, after = '', fallback = '텍스트') {
    if (!active) return
    const { start, end } = selection.current
    const content = active.content
    const text = content.slice(start, end) || fallback
    update(active.id, { content: content.slice(0, start) + before + text + after + content.slice(end) })
    requestAnimationFrame(() => {
      sourceRef.current?.focus()
      sourceRef.current?.setSelectionRange(start + before.length, start + before.length + text.length)
    })
  }
  function renderMenu() {
    return (
      <div className="doc-add-menu" aria-label="블록 종류">
        {blockTypes.map((type) => {
          const Icon = icons[type]
          return (
            <button
              type="button"
              key={type}
              disabled={value.blocks.length >= MAX_BLOCKS}
              onClick={() => add(type)}
            >
              <Icon size={17} />
              <span>{blockLabels[type]}</span>
            </button>
          )
        })}
      </div>
    )
  }
  return (
    <section className="document-editor" aria-label="상세 본문 편집기">
      <div className="document-editor-heading">
        <div>
          <span className="document-editor-kicker">DOCUMENT STUDIO</span>
          <h3>상세 본문</h3>
          <p>블록을 쌓아, 읽기 쉬운 안내를 만들어 보세요.</p>
        </div>
        <span className="doc-block-count">
          {value.blocks.length} / {MAX_BLOCKS} 블록
        </span>
      </div>
      <div className="doc-editor-toolbar">
        <div className="doc-add-wrap">
          <button
            type="button"
            className="doc-tool-button primary"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
            disabled={value.blocks.length >= MAX_BLOCKS}
          >
            <Plus size={16} />
            블록 추가
          </button>
          {menu && renderMenu()}
        </div>
        <div className="doc-history">
          <button
            type="button"
            className="doc-tool-icon"
            aria-label="본문 실행 취소"
            title="실행 취소"
            disabled={!past.length}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            className="doc-tool-icon"
            aria-label="본문 다시 실행"
            title="다시 실행"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
        </div>
        <div className="doc-mode-switch" aria-label="본문 보기 방식">
          {(
            [
              ['edit', '편집'],
              ['split', '나란히 보기'],
              ['preview', '미리보기'],
            ] as const
          ).map(([key, label]) => (
            <button type="button" key={key} aria-pressed={mode === key} onClick={() => setMode(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className={`doc-workbench doc-mode-${mode}`}>
        {mode !== 'preview' && (
          <div className="doc-edit-canvas">
            {!value.blocks.length && (
              <div className="doc-editor-empty">
                <span>
                  <AlignLeft size={30} strokeWidth={1.2} />
                </span>
                <h4>빈 페이지에서 시작하세요</h4>
                <p>
                  텍스트부터 이미지, 숫자와 다이어그램까지.
                  <br />
                  필요한 블록을 자유롭게 추가할 수 있습니다.
                </p>
                <div>
                  <button type="button" className="doc-tool-button primary" onClick={() => add('markdown')}>
                    <Plus size={15} />첫 블록 쓰기
                  </button>
                  <button
                    type="button"
                    className="doc-tool-button"
                    onClick={() => {
                      const next = createTemplate()
                      commit(next)
                      setSelected(next.blocks[0].id)
                    }}
                  >
                    <Sparkles size={15} />
                    안내 템플릿
                  </button>
                </div>
              </div>
            )}
            {value.blocks.map((block, index) => {
              const Icon = icons[block.type]
              const editing = block.id === selected
              return (
                <div
                  key={block.id}
                  className={`doc-editor-block ${editing ? 'is-selected' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = value.blocks.findIndex((b) => b.id === dragging.current)
                    if (from >= 0) move(from, index)
                    dragging.current = ''
                  }}
                >
                  <div className="doc-block-bar">
                    <button
                      type="button"
                      draggable
                      className="doc-tool-icon doc-drag-handle"
                      aria-label={`${index + 1}번 블록 드래그로 이동`}
                      title="드래그하여 순서 변경"
                      onDragStart={(e) => {
                        dragging.current = block.id
                        e.dataTransfer.setData('text/plain', block.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        dragging.current = ''
                      }}
                    >
                      <GripVertical size={16} />
                    </button>
                    <button
                      type="button"
                      className="doc-block-select"
                      aria-expanded={editing}
                      onClick={() => {
                        selection.current = { start: 0, end: 0 }
                        setSelected(editing ? '' : block.id)
                      }}
                    >
                      <Icon size={14} />
                      <span>
                        {String(index + 1).padStart(2, '0')} · {blockLabels[block.type]}
                      </span>
                    </button>
                    <div className="doc-block-actions">
                      <button
                        type="button"
                        className="doc-tool-icon"
                        aria-label={`${index + 1}번 블록 위로`}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="doc-tool-icon"
                        aria-label={`${index + 1}번 블록 아래로`}
                        disabled={index === value.blocks.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="doc-tool-icon"
                        aria-label={`${index + 1}번 블록 복제`}
                        disabled={value.blocks.length >= MAX_BLOCKS}
                        onClick={() => {
                          const copy = { ...block, id: crypto.randomUUID() }
                          const blocks = [...value.blocks]
                          blocks.splice(index + 1, 0, copy)
                          commit({ ...value, blocks })
                          setSelected(copy.id)
                        }}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className="doc-tool-icon"
                        aria-label={`${index + 1}번 블록 삭제`}
                        onClick={() => {
                          commit({ ...value, blocks: value.blocks.filter((b) => b.id !== block.id) })
                          if (editing) setSelected('')
                          setNotice('블록을 삭제했습니다. 실행 취소로 복원할 수 있습니다.')
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {editing ? (
                    <div className="doc-block-fields">
                      <p className="doc-field-help">{help[block.type]}</p>
                      {['markdown', 'callout'].includes(block.type) && (
                        <div className="doc-format-toolbar" aria-label="마크다운 서식">
                          {[
                            { label: '제목 넣기', icon: Heading2, before: '\n## ', fallback: '제목' },
                            { label: '굵게', icon: Bold, before: '**', after: '**' },
                            { label: '기울임', icon: Italic, before: '*', after: '*' },
                            {
                              label: '형광 강조',
                              icon: Highlighter,
                              before: '<mark class="doc-highlight">',
                              after: '</mark>',
                            },
                            {
                              label: '본문 숫자 강조',
                              icon: Hash,
                              before: '<span class="doc-number">',
                              after: '</span>',
                              fallback: '100',
                            },
                            { label: '목록 넣기', icon: List, before: '\n- ' },
                            { label: '체크리스트 넣기', icon: CheckSquare, before: '\n- [ ] ' },
                            { label: '인용 넣기', icon: Quote, before: '\n> ' },
                            { label: '링크 넣기', icon: Link2, before: '[', after: '](https://example.com)' },
                            {
                              label: '표 넣기',
                              icon: Table2,
                              before: '\n| 항목 | 내용 |\n| --- | --- |\n| ',
                              after: ' | 입력 |\n',
                            },
                          ].map(({ label, icon: ToolIcon, before, after, fallback }) => (
                            <button
                              type="button"
                              key={label}
                              className="doc-tool-icon"
                              title={label}
                              aria-label={label}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => insert(before, after, fallback)}
                            >
                              <ToolIcon size={16} />
                            </button>
                          ))}
                        </div>
                      )}
                      {block.type !== 'divider' && block.type !== 'image' && (
                        <textarea
                          ref={sourceRef}
                          aria-label={`${index + 1}번 블록 내용`}
                          className={`doc-source doc-source-${block.type}`}
                          maxLength={20000}
                          rows={block.type === 'stat' ? 2 : 7}
                          value={block.content}
                          spellCheck={!['mermaid', 'html'].includes(block.type)}
                          placeholder={
                            block.type === 'stat'
                              ? '예: 128건, 3.2억 원, 87%'
                              : block.type === 'html'
                                ? '<div class="doc-box" style="background-color:#eef4e8">안내 내용</div>'
                                : block.type === 'mermaid'
                                  ? 'flowchart LR\n  A[시작] --> B[완료]'
                                  : '내용을 입력하세요. / 를 입력하면 블록 종류를 선택할 수 있습니다.'
                          }
                          onSelect={(e) => {
                            selection.current = {
                              start: e.currentTarget.selectionStart,
                              end: e.currentTarget.selectionEnd,
                            }
                          }}
                          onChange={(e) => update(block.id, { content: e.target.value })}
                        />
                      )}
                      {block.type === 'markdown' && block.content === '/' && renderMenu()}
                      {block.type === 'mermaid' && (
                        <button
                          type="button"
                          className="doc-tool-button"
                          onClick={() =>
                            update(block.id, {
                              content: block.content ? block.content + '\n' + diagramExample : diagramExample,
                            })
                          }
                          disabled={Boolean(block.content)}
                        >
                          <Network size={14} />
                          흐름도 예제 넣기
                        </button>
                      )}
                      {block.type === 'image' && (
                        <>
                          <label>
                            이미지 주소
                            <input
                              aria-label={`${index + 1}번 이미지 주소`}
                              type="text"
                              value={block.content.startsWith('blob:') ? '' : block.content}
                              placeholder="https://…"
                              onChange={(e) => update(block.id, { content: e.target.value })}
                            />
                          </label>
                          <label className="doc-image-upload">
                            <ImagePlus size={16} />
                            이미지 파일 선택
                            <input
                              aria-label={`${index + 1}번 본문 이미지 파일`}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  if (
                                    file.size > 10 * 1024 * 1024 ||
                                    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
                                  ) {
                                    setNotice('JPG · PNG · WebP 형식의 10MB 이하 이미지를 선택해 주세요.')
                                    return
                                  }
                                  update(block.id, { content: onImageFile(file) })
                                }
                              }}
                            />
                          </label>
                        </>
                      )}
                      {['stat', 'image'].includes(block.type) && (
                        <label>
                          {block.type === 'stat' ? '숫자 설명' : '이미지 캡션'}
                          <input
                            aria-label={`${index + 1}번 블록 캡션`}
                            maxLength={300}
                            value={block.caption}
                            placeholder={
                              block.type === 'stat'
                                ? '예: 확인된 피해 사례 · 2026년 10월 기준'
                                : '이미지에 대한 설명'
                            }
                            onChange={(e) => update(block.id, { caption: e.target.value })}
                          />
                        </label>
                      )}
                      <StyleControls style={block.style} onChange={(style) => update(block.id, { style })} />
                      {mode === 'edit' && (
                        <div className="doc-inline-preview">
                          <span>블록 미리보기</span>
                          <DocumentBlockView block={block} localImage />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="doc-block-preview">
                      <DocumentBlockView block={block} localImage />
                      {!block.content && block.type !== 'divider' && (
                        <button
                          type="button"
                          className="doc-empty-edit"
                          onClick={() => setSelected(block.id)}
                        >
                          내용을 작성하려면 클릭하세요
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {value.blocks.length > 0 && (
              <button
                type="button"
                className="doc-append"
                onClick={() => add('markdown')}
                disabled={value.blocks.length >= MAX_BLOCKS}
              >
                <Plus size={16} />
                텍스트 블록 추가 <span>/ 로 다른 블록 선택</span>
              </button>
            )}
          </div>
        )}
        {mode !== 'edit' && (
          <div className="doc-preview-canvas">
            <div className="doc-preview-label">
              <span className="doc-live-dot" />
              본문 미리보기<span>저장 후 상세페이지에 반영</span>
            </div>
            {value.blocks.length ? (
              <CompanyDocumentView document={deferred} localImages />
            ) : (
              <p className="doc-preview-empty">작성한 내용이 여기에 표시됩니다.</p>
            )}
          </div>
        )}
      </div>
      <div className="doc-editor-footer">
        <span role="status">{notice || '마크다운 · HTML 지원 / 변경사항은 저장하기를 눌러 반영하세요.'}</span>
        <span className={chars > MAX_DOCUMENT_LENGTH ? 'doc-limit-error' : ''}>
          {chars.toLocaleString()} / 100,000자
        </span>
      </div>
      <details className="doc-writing-guide">
        <summary>마크다운 · HTML 작성 도움말</summary>
        <div>
          <p>
            <code>## 제목</code> · <code>**굵게**</code> · <code>- 목록</code> · <code>- [ ] 체크리스트</code>{' '}
            · <code>[링크](https://…)</code>
          </p>
          <p>
            마크다운 안에 <code>```mermaid</code> 코드 블록을 넣어도 다이어그램으로 표시됩니다.
          </p>
          <p>
            HTML 예시: <code>{'<span style="color:#bd633f">색상 강조</span>'}</code>
          </p>
          <p>
            서식 클래스: <code>doc-box</code> 박스 · <code>doc-highlight</code> 형광 강조 ·{' '}
            <code>doc-number</code> 숫자 강조 · <code>doc-fade</code> / <code>doc-pulse</code> /{' '}
            <code>doc-float</code> 애니메이션
          </p>
          <p>
            제목·목록·표·이미지·접기(details) 태그와 색상·글자 크기·여백·테두리·그림자 스타일을 지원합니다.
          </p>
        </div>
      </details>
    </section>
  )
}

function StyleControls({ style, onChange }: { style: BlockStyle; onChange: (style: BlockStyle) => void }) {
  function set<K extends keyof BlockStyle>(key: K, value: BlockStyle[K]) {
    onChange({ ...style, [key]: value })
  }
  return (
    <details className="doc-style-controls">
      <summary>
        <Sparkles size={14} />
        색상 · 박스 · 효과
      </summary>
      <div className="doc-style-panel">
        <div className="doc-colors">
          {(
            [
              ['color', '글자 색상'],
              ['background', '배경 색상'],
              ['borderColor', '테두리 색상'],
              ['accent', '강조 색상'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="color"
                aria-label={label}
                value={style[key] === 'transparent' ? '#ffffff' : style[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="doc-transparent">
          <input
            type="checkbox"
            checked={style.background === 'transparent'}
            onChange={(e) => set('background', e.target.checked ? 'transparent' : '#f1f5ec')}
          />
          배경 투명하게
        </label>
        <div className="doc-style-grid">
          <label>
            그림자
            <select
              aria-label="그림자"
              value={style.shadow}
              onChange={(e) => set('shadow', e.target.value as BlockStyle['shadow'])}
            >
              <option value="none">없음</option>
              <option value="soft">은은하게</option>
              <option value="strong">선명하게</option>
            </select>
          </label>
          <label>
            강조 애니메이션
            <select
              aria-label="강조 애니메이션"
              value={style.animation}
              onChange={(e) => set('animation', e.target.value as BlockStyle['animation'])}
            >
              <option value="none">없음</option>
              <option value="fade">서서히 등장</option>
              <option value="pulse">은은한 강조</option>
              <option value="float">살짝 떠오르기</option>
            </select>
          </label>
          <label>
            정렬
            <select
              aria-label="정렬"
              value={style.align}
              onChange={(e) => set('align', e.target.value as BlockStyle['align'])}
            >
              <option value="left">왼쪽</option>
              <option value="center">가운데</option>
              <option value="right">오른쪽</option>
            </select>
          </label>
          {(
            [
              ['fontSize', '글자 크기', 12, 72],
              ['radius', '모서리 둥글기', 0, 40],
              ['padding', '안쪽 여백', 0, 64],
              ['borderWidth', '테두리 두께', 0, 8],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <span className="doc-number-control">
                <input
                  type="number"
                  aria-label={label}
                  min={min}
                  max={max}
                  value={style[key]}
                  onChange={(e) => set(key, Math.min(max, Math.max(min, Number(e.target.value))))}
                />
                px
              </span>
            </label>
          ))}
        </div>
        <button type="button" className="doc-style-reset" onClick={() => onChange({ ...defaultBlockStyle })}>
          스타일 초기화
        </button>
      </div>
    </details>
  )
}
