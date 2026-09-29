import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, Maximize2 } from 'lucide-react'
import type { RollingCase } from '../lib/types'
import { Modal } from './ui'
export default function RollingShowcase({ items }: { items: RollingCase[] }) {
  const track = useRef<HTMLDivElement>(null),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [selected, setSelected] = useState<RollingCase | null>(null)
  useEffect(() => {
    if (
      paused ||
      hover ||
      selected ||
      items.length < 2 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return
    const timer = setInterval(() => {
      const el = track.current
      if (!el || document.hidden) return
      const step = (el.firstElementChild?.getBoundingClientRect().width || 320) + 24
      el.scrollTo({
        left: el.scrollLeft + el.clientWidth >= el.scrollWidth - 5 ? 0 : el.scrollLeft + step,
        behavior: 'smooth',
      })
    }, 4500)
    return () => clearInterval(timer)
  }, [paused, hover, selected, items.length])
  if (!items.length) return null
  const move = (direction: number) => {
    const el = track.current
    if (el)
      el.scrollBy({
        left: direction * ((el.firstElementChild?.getBoundingClientRect().width || 320) + 24),
        behavior: 'smooth',
      })
  }
  return (
    <section className="section container rolling-showcase" aria-label="등록된 사건 사례">
      <p className="eyebrow" data-reveal>
        NARAN · CASE RESULTS
      </p>
      <div className="section-heading" data-reveal>
        <div>
          <h2>사건의 기록, 나란의 발걸음.</h2>
          <p className="muted">개별 사건의 결과는 사실관계와 증거에 따라 달라집니다.</p>
        </div>
        <div className="rolling-controls">
          <button className="icon-button" aria-label="이전 사례" onClick={() => move(-1)}>
            <ChevronLeft size={20} />
          </button>
          <button
            className="icon-button"
            aria-label={paused ? '자동 재생' : '자동 재생 정지'}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
          <button className="icon-button" aria-label="다음 사례" onClick={() => move(1)}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div
        className="rolling-track"
        data-reveal
        ref={track}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocusCapture={() => setHover(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(false)
        }}
      >
        {items.map((item) => (
          <button className="rolling-card" key={item.id} onClick={() => setSelected(item)}>
            <div className="rolling-image">
              <img src={item.image} alt={`${item.title} 관련 자료`} loading="lazy" />
              <span>
                <Maximize2 size={15} />
                크게 보기
              </span>
            </div>
            <div className="rolling-copy">
              <span>{item.category}</span>
              <h3>{item.title}</h3>
              <strong>{item.result}</strong>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <Modal title={selected.title} wide onClose={() => setSelected(null)}>
          <div className="rolling-document">
            <p>
              {selected.category} · {selected.result}
            </p>
            <img src={selected.image} alt={`${selected.title} 관련 자료`} />
          </div>
        </Modal>
      )}
    </section>
  )
}
