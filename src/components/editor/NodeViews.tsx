import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { DOMSerializer } from '@tiptap/pm/model'
import { AlignCenter, AlignLeft, AlignRight, Images, Pencil, Trash2, X } from 'lucide-react'
import { cardFields, cardLabels, normalizeUrl, type CardType } from './options'

// 사진 설명 입력에서 엔터가 바깥 저장 폼을 제출하지 않게 합니다.
const keepInEditor = (e: KeyboardEvent) => {
  if (e.key === 'Enter') e.preventDefault()
}
function NodeButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

const sizes = [
  ['small', '작게'],
  ['medium', '중간'],
  ['full', '문서 너비'],
] as const
const aligns = [
  ['left', '왼쪽 정렬', AlignLeft],
  ['center', '가운데 정렬', AlignCenter],
  ['right', '오른쪽 정렬', AlignRight],
] as const

export function ImageView({ node, selected, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const { src, alt, caption, align, size } = node.attrs
  return (
    <NodeViewWrapper
      as="figure"
      data-type="image"
      data-align={align}
      data-size={size}
      className={`se-node${selected ? ' is-selected' : ''}`}
    >
      <img src={src} alt={alt || caption || '본문 사진'} draggable={false} data-drag-handle />
      {selected && (
        <div className="se-node-toolbar" contentEditable={false}>
          {sizes.map(([key, label]) => (
            <NodeButton
              key={key}
              label={`사진 크기 ${label}`}
              active={size === key}
              onClick={() => updateAttributes({ size: key })}
            >
              {label}
            </NodeButton>
          ))}
          <span />
          {aligns.map(([key, label, Icon]) => (
            <NodeButton
              key={key}
              label={`사진 ${label}`}
              active={align === key}
              onClick={() => updateAttributes({ align: key })}
            >
              <Icon size={15} />
            </NodeButton>
          ))}
          <span />
          <NodeButton label="사진 삭제" onClick={deleteNode}>
            <Trash2 size={15} />
          </NodeButton>
        </div>
      )}
      <input
        className="se-caption-input"
        aria-label="사진 설명"
        maxLength={300}
        value={caption}
        placeholder="사진 설명을 입력하세요."
        onKeyDown={keepInEditor}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
      />
    </NodeViewWrapper>
  )
}

export function GalleryView({
  node,
  selected,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}: ReactNodeViewProps) {
  const { images, layout, caption } = node.attrs as {
    images: { src: string; alt: string }[]
    layout: 'collage' | 'slide'
    caption: string
  }
  function remove(index: number) {
    const rest = images.filter((_, i) => i !== index)
    const pos = getPos()
    // 한 장만 남으면 일반 사진으로 바꿔 크기·정렬 기능을 그대로 쓸 수 있게 합니다.
    if (rest.length === 1 && typeof pos === 'number')
      editor
        .chain()
        .insertContentAt(
          { from: pos, to: pos + node.nodeSize },
          { type: 'image', attrs: { ...rest[0], caption } },
        )
        .run()
    else if (!rest.length) deleteNode()
    else updateAttributes({ images: rest })
  }
  return (
    <NodeViewWrapper
      as="figure"
      data-type="gallery"
      data-layout={layout}
      className={`se-node${selected ? ' is-selected' : ''}`}
    >
      <div data-drag-handle>
        {images.map((img, i) => (
          <img key={img.src + i} src={img.src} alt={img.alt || `사진 ${i + 1}`} draggable={false} />
        ))}
      </div>
      {selected && (
        <div className="se-node-toolbar" contentEditable={false}>
          <NodeButton
            label="콜라주로 보기"
            active={layout === 'collage'}
            onClick={() => updateAttributes({ layout: 'collage' })}
          >
            콜라주
          </NodeButton>
          <NodeButton
            label="슬라이드로 보기"
            active={layout === 'slide'}
            onClick={() => updateAttributes({ layout: 'slide' })}
          >
            슬라이드
          </NodeButton>
          <span />
          <span className="se-node-count">
            <Images size={14} />
            {images.length}장
          </span>
          {images.map((img, i) => (
            <span key={img.src + i} className="se-node-thumb">
              <img src={img.src} alt="" />
              <NodeButton label={`${i + 1}번 사진 빼기`} onClick={() => remove(i)}>
                <X size={11} />
              </NodeButton>
            </span>
          ))}
          <span />
          <NodeButton label="사진 묶음 삭제" onClick={deleteNode}>
            <Trash2 size={15} />
          </NodeButton>
        </div>
      )}
      <input
        className="se-caption-input"
        aria-label="사진 묶음 설명"
        maxLength={300}
        value={caption}
        placeholder="사진 설명을 입력하세요."
        onKeyDown={keepInEditor}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
      />
    </NodeViewWrapper>
  )
}

// 카드 모양은 노드의 renderHTML 결과를 그대로 그려 상세페이지와 같게 유지합니다.
export function CardView({ node, selected, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const type = node.type.name as CardType
  const preview = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  useLayoutEffect(() => {
    const spec = node.type.spec.toDOM?.(node)
    if (spec && preview.current) preview.current.replaceChildren(DOMSerializer.renderSpec(document, spec).dom)
  }, [node])
  return (
    <NodeViewWrapper className={`se-node se-card-node${selected ? ' is-selected' : ''}`}>
      {/* 편집 중에는 카드 안의 링크를 눌러도 이동하지 않습니다. */}
      <div ref={preview} data-drag-handle onClickCapture={(e) => e.preventDefault()} />
      {selected && !editing && (
        <div className="se-node-toolbar" contentEditable={false}>
          <NodeButton label={`${cardLabels[type]} 수정`} onClick={() => setEditing(true)}>
            <Pencil size={14} />
            수정
          </NodeButton>
          <NodeButton label={`${cardLabels[type]} 삭제`} onClick={deleteNode}>
            <Trash2 size={15} />
          </NodeButton>
        </div>
      )}
      {selected && editing && (
        <div className="se-card-edit" contentEditable={false}>
          <CardForm
            type={type}
            initial={node.attrs}
            submitLabel="수정 완료"
            onCancel={() => setEditing(false)}
            onSubmit={(values) => {
              updateAttributes(values)
              setEditing(false)
            }}
          />
        </div>
      )}
    </NodeViewWrapper>
  )
}

export function CardForm({
  type,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  type: CardType
  initial?: Record<string, string>
  submitLabel: string
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
}) {
  const fields = cardFields[type]
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.key, String(initial?.[f.key] ?? '')])),
  )
  const [error, setError] = useState('')
  function submit() {
    const next = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]))
    const missing = fields.find((f) => f.required && !next[f.key])
    if (missing) return setError(`${missing.label} 항목을 입력해 주세요.`)
    if (type === 'linkCard') {
      next.url = normalizeUrl(next.url)
      if (!next.url) return setError('http 또는 https로 시작하는 주소를 입력해 주세요.')
    }
    onSubmit(next)
  }
  return (
    <div
      className="se-form"
      onKeyDown={(e) => {
        // 바깥 저장 폼 제출과 관리자 창 닫기를 막고, 이 입력 창 안에서만 처리합니다.
        if (e.key === 'Enter') {
          e.preventDefault()
          submit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      {fields.map((f, i) => (
        <label key={f.key}>
          <span>
            {f.label}
            {f.required && <em>필수</em>}
          </span>
          <input
            type={f.type || 'text'}
            autoFocus={i === 0}
            maxLength={f.type === 'url' ? 1000 : 200}
            value={values[f.key]}
            placeholder={f.placeholder}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        </label>
      ))}
      {error && (
        <p className="se-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="se-form-actions">
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <button type="button" className="primary" onClick={submit}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
