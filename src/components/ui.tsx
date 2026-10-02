import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowRight, Check, X } from 'lucide-react'
import type { Article } from '../lib/types'

export function ArrowLink({
  to,
  children,
  className = '',
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link className={`arrow-link ${className}`} to={to}>
      {children}
      <ArrowRight size={16} strokeWidth={1.5} />
    </Link>
  )
}
export function PageHero({
  eyebrow,
  title,
  description,
  parent,
}: {
  eyebrow: string
  title: string
  description?: string
  parent?: { title: string; path: string }
}) {
  return (
    <section className="page-hero">
      <div className="container" data-reveal-group>
        <div className="breadcrumbs">
          <Link to="/">홈</Link>
          <span>/</span>
          {parent ? (
            <>
              <Link to={parent.path}>{parent.title}</Link>
              <span>/</span>
            </>
          ) : null}
          <span>{eyebrow}</span>
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
    </section>
  )
}
export function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="checklist">
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>
          <Check size={16} strokeWidth={1.5} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
export function ArticleCard({ article, index }: { article: Article; index?: number }) {
  const paths = { practice: 'practice', case: 'cases', guide: 'guides', faq: 'faq', lawyer: 'lawyers' }
  return (
    <Link
      to={`/${paths[article.kind]}/${article.id}`}
      className={`article-card card-${article.kind}`}
      data-reveal
      data-reveal-delay={index === undefined ? undefined : (index % 3) * 80}
    >
      <span className="card-kicker">
        {index !== undefined
          ? String(index + 1).padStart(2, '0')
          : article.kind === 'case'
            ? `${article.category} · 가상 예시`
            : article.category}
      </span>
      <h3>{article.title}</h3>
      <p>{article.excerpt}</p>
      <span className="card-link">
        자세히 보기
        <ArrowUpRight size={17} strokeWidth={1.4} />
      </span>
    </Link>
  )
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = '',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = old
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''} ${className}`}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">—</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  )
}
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      {message}
      {onRetry && (
        <button className="text-button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  )
}
