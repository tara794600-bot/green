import { memo, useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import DOMPurify from 'dompurify'
import {
  isImageUrl,
  markdownParts,
  sanitizeContent,
  type CompanyDocument,
  type DocumentBlock,
} from '../../shared/company-document.mjs'
import './company-document.css'

let engine: Promise<(typeof import('mermaid'))['default']> | undefined
function diagramEngine() {
  return (engine ??= import('mermaid')
    .then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        htmlLabels: false,
        theme: 'neutral',
        suppressErrorRendering: true,
        maxTextSize: 20000,
        maxEdges: 200,
        flowchart: { htmlLabels: false },
      })
      return mermaid
    })
    .catch((error) => {
      engine = undefined
      throw error
    }))
}

function Diagram({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [result, setResult] = useState({ source: '', svg: '', error: '' })
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        if (/%%\s*\{|^\s*---/.test(source)) throw new Error('config')
        const mermaid = await diagramEngine()
        if (!active) return
        const { svg } = await mermaid.render(`diagram-${id}-${crypto.randomUUID()}`, source)
        if (active)
          setResult({
            source,
            svg: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } }),
            error: '',
          })
      } catch {
        if (active)
          setResult({
            source,
            svg: '',
            error:
              '다이어그램을 표시할 수 없습니다. Mermaid 문법을 확인해 주세요. 설정 지시문은 지원하지 않습니다.',
          })
      }
    }, 400)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [id, source])
  const current = result.source === source
  return (
    <div className="doc-diagram">
      {current && result.svg ? (
        <div
          role="img"
          aria-label="본문 다이어그램"
          className="doc-diagram-svg"
          dangerouslySetInnerHTML={{ __html: result.svg }}
        />
      ) : (
        <p role="status" className={current && result.error ? 'doc-diagram-error' : ''}>
          {current && result.error ? result.error : '다이어그램을 준비하고 있습니다…'}
        </p>
      )}
      <details className="doc-diagram-source">
        <summary>다이어그램 원문</summary>
        <pre>{source}</pre>
      </details>
    </div>
  )
}

const Markdown = memo(function Markdown({ source }: { source: string }) {
  const parts = useMemo(() => markdownParts(source), [source])
  return parts.map((part, i) =>
    part.kind === 'diagram' ? (
      <Diagram key={i} source={part.content} />
    ) : (
      <div key={i} className="doc-prose" dangerouslySetInnerHTML={{ __html: part.content }} />
    ),
  )
})

export const DocumentBlockView = memo(function DocumentBlockView({
  block,
  localImage = false,
}: {
  block: DocumentBlock
  localImage?: boolean
}) {
  const { style, type, content, caption } = block
  const safeHtml = useMemo(() => (type === 'html' ? sanitizeContent(content) : ''), [type, content])
  const css = {
    color: style.color,
    backgroundColor: style.background,
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    borderStyle: 'solid',
    borderRadius: style.radius,
    padding: style.padding,
    textAlign: style.align,
    fontSize: style.fontSize,
    '--doc-accent': style.accent,
  } as CSSProperties
  return (
    <div
      className={`doc-block doc-type-${type} doc-shadow-${style.shadow} doc-${style.animation}`}
      style={css}
    >
      {type === 'divider' ? (
        <hr style={{ borderColor: style.accent }} />
      ) : type === 'stat' ? (
        <>
          <strong className="doc-stat-value">{content || '—'}</strong>
          {caption && <p className="doc-stat-caption">{caption}</p>}
        </>
      ) : type === 'mermaid' ? (
        content.trim() ? (
          <Diagram source={content} />
        ) : (
          <p className="doc-placeholder">다이어그램 코드를 입력하세요.</p>
        )
      ) : type === 'html' ? (
        <div className="doc-prose" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : type === 'image' ? (
        <figure>
          {isImageUrl(content) || (localImage && content.startsWith('blob:')) ? (
            <img src={content} alt={caption || '본문 이미지'} loading="lazy" />
          ) : (
            <p className="doc-placeholder">이미지를 업로드하거나 HTTPS 주소를 입력하세요.</p>
          )}
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      ) : (
        <Markdown source={content} />
      )}
    </div>
  )
})

export default function CompanyDocumentView({
  document,
  localImages = false,
}: {
  document: CompanyDocument
  localImages?: boolean
}) {
  return (
    <div className="company-rich-document">
      {document.blocks.map((block) => (
        <DocumentBlockView key={block.id} block={block} localImage={localImages} />
      ))}
    </div>
  )
}
