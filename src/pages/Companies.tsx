import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Phone, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useContent } from '../lib/content-context'
import { api, ApiError, errorMessage } from '../lib/api'
import type { CompanyCase } from '../lib/types'
import { PageHero, EmptyState, ErrorNotice } from '../components/ui'
import { ContactBanner } from '../components/Layout'
import CompanyDocumentView from '../components/CompanyDocument'
import './companies.css'

export function CompanyCards({ items }: { items: CompanyCase[] }) {
  return (
    <div className="company-grid">
      {items.map((item) => (
        <Link className="company-card" key={item.id} to={`/companies/${item.id}`}>
          <div className="company-card-image">
            <img src={item.image} alt={`${item.name} 관련 자료`} loading="lazy" />
          </div>
          <div className="company-card-copy">
            <span>{item.service}</span>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            <strong>
              상세 안내 보기
              <ArrowUpRight size={16} />
            </strong>
          </div>
        </Link>
      ))}
    </div>
  )
}
export default function Companies({ id }: { id?: string }) {
  return id ? <CompanyDetail key={id} id={id} /> : <CompanyDirectory />
}
function CompanyDirectory() {
  const { companies = [] } = useContent(),
    [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [input, setInput] = useState(q)
  const filtered = companies.filter((c) =>
    `${c.name} ${c.service} ${c.description}`.toLowerCase().includes(q.trim().toLowerCase()),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / 40)),
    page = Math.max(1, Math.min(pages, Number.parseInt(params.get('page') || '1', 10) || 1))
  return (
    <>
      <PageHero
        eyebrow="COMPANY DIRECTORY"
        title={'업체 정보부터,\n차분히 확인하세요.'}
        description="업체명이나 피해 유형으로 등록된 정보를 찾아보세요."
      />
      <section className="section container company-directory">
        <form
          className="company-search"
          onSubmit={(e) => {
            e.preventDefault()
            setParams(input.trim() ? { q: input.trim() } : {})
          }}
        >
          <Search size={21} />
          <input
            type="search"
            aria-label="업체명 또는 피해 유형 검색"
            placeholder="업체명 또는 피해 유형을 입력해 주세요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="button small">검색</button>
        </form>
        <div className="company-results">
          <p>
            {q ? `“${q}” 검색 결과` : '등록된 업체 정보'} <strong>{filtered.length}</strong>건
          </p>
          {q && (
            <button
              className="text-button"
              onClick={() => {
                setParams({})
                setInput('')
              }}
            >
              전체 보기
            </button>
          )}
        </div>
        {filtered.length ? (
          <CompanyCards items={filtered.slice((page - 1) * 40, page * 40)} />
        ) : (
          <EmptyState
            title={q ? '검색 결과가 없습니다.' : '등록된 업체 정보가 없습니다.'}
            description="업체 정보가 없더라도 현재 상황에 대한 상담을 신청할 수 있습니다."
          >
            <Link className="button outline" to="/consultation">
              상담 신청
              <ArrowRight size={16} />
            </Link>
          </EmptyState>
        )}
        {pages > 1 && (
          <nav className="company-pagination" aria-label="업체 목록 페이지">
            <button
              className="icon-button"
              aria-label="이전 페이지"
              disabled={page === 1}
              onClick={() => setParams({ ...(q ? { q } : {}), page: String(page - 1) })}
            >
              <ChevronLeft size={20} />
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              className="icon-button"
              aria-label="다음 페이지"
              disabled={page === pages}
              onClick={() => setParams({ ...(q ? { q } : {}), page: String(page + 1) })}
            >
              <ChevronRight size={20} />
            </button>
          </nav>
        )}
      </section>
      <ContactBanner />
    </>
  )
}
function CompanyDetail({ id }: { id: string }) {
  const { selectedCompany, companies = [], settings } = useContent()
  const [item, setItem] = useState<CompanyCase | null>(
    selectedCompany?.id === id ? selectedCompany : companies.find((c) => c.id === id) || null,
  )
  const [loading, setLoading] = useState(selectedCompany === undefined && !item),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api<CompanyCase>(`/companies/${encodeURIComponent(id)}`)
      .then((value) => {
        if (active) {
          setItem(value)
          document.title = `${value.name} | 법무법인 나란`
        }
      })
      .catch((e) => {
        if (active) {
          setError(errorMessage(e))
          if (e instanceof ApiError && e.status === 404) setItem(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])
  if (loading)
    return (
      <section className="section container">
        <p role="status">업체 정보를 불러오는 중입니다…</p>
      </section>
    )
  if (!item)
    return (
      <>
        <PageHero eyebrow="COMPANY DIRECTORY" title="업체 정보를 찾을 수 없습니다." />
        <div className="section container">
          {error && <ErrorNotice message={error} />}
          <Link className="button outline" to="/companies">
            업체 목록으로
          </Link>
        </div>
      </>
    )
  if (item.visibility === 'phone')
    return (
      <>
        <PageHero
          eyebrow="CONTACT NARAN"
          title={`${item.name}\n전화 상담으로 안내해 드립니다.`}
          parent={{ title: '업체 정보', path: '/companies' }}
        />
        <section className="section container company-phone">
          <span className="company-phone-icon">
            <Phone size={32} strokeWidth={1.4} />
          </span>
          <h2>자세한 내용은 전화로 문의해 주세요.</h2>
          <p>현재 상황을 말씀해 주시면 상담을 안내해 드리겠습니다.</p>
          <a className="button" href={`tel:${settings.phone}`}>
            <Phone size={18} />
            {settings.phone}
          </a>
          <Link className="arrow-link" to="/companies">
            업체 목록으로 돌아가기
            <ArrowRight size={16} />
          </Link>
        </section>
      </>
    )
  return (
    <>
      <PageHero
        eyebrow={item.service}
        title={item.name}
        parent={{ title: '업체 정보', path: '/companies' }}
      />
      <section className="section container company-detail-grid">
        <div className="company-document">
          <img src={item.image} alt={`${item.name} 관련 안내 자료`} />
        </div>
        <div className="company-detail-copy">
          <p className="eyebrow">CASE INFORMATION</p>
          <h2>관련 정보 안내</h2>
          <p className="company-detail-description">{item.description}</p>
          <div className="company-detail-cta">
            <h3>비슷한 상황을 겪고 계신가요?</h3>
            <p>현재 상황과 자료를 함께 살펴보겠습니다.</p>
            <Link className="button full" to={`/consultation?company=${encodeURIComponent(item.name)}`}>
              피해 사실 상담하기
              <ArrowRight size={16} />
            </Link>
            <a className="button outline full" href={`tel:${settings.phone}`}>
              <Phone size={16} />
              {settings.phone}
            </a>
            {settings.kakaoUrl && (
              <a className="text-button" href={settings.kakaoUrl} target="_blank" rel="noreferrer">
                카카오톡으로 문의하기
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </div>
      </section>
      {item.document?.blocks.length ? (
        <section className="container company-rich-section" aria-label="업체 상세 본문">
          <CompanyDocumentView document={item.document} />
        </section>
      ) : null}
      <div className="container company-back">
        <Link className="arrow-link" to="/companies">
          업체 목록으로 돌아가기
          <ArrowRight size={16} />
        </Link>
      </div>
      <ContactBanner />
    </>
  )
}
