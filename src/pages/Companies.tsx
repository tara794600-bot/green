import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Phone, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useContent } from '../lib/content-context'
import { api, ApiError, errorMessage } from '../lib/api'
import type { CompanyCase } from '../lib/types'
import { PageHero, EmptyState, ErrorNotice, KakaoIcon } from '../components/ui'
import { ContactBanner } from '../components/Layout'
import CompanyDocumentView from '../components/CompanyDocument'
import { hasDocumentContent } from '../../shared/company-document.mjs'
import { companyTitle, fullTitle } from '../../shared/seo.mjs'
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
const pageLink = (q: string, page: number) => {
  const params = new URLSearchParams(q ? { q } : {})
  if (page > 1) params.set('page', String(page))
  return '/companies' + (params.size ? '?' + params : '')
}
// ISO 날짜의 앞부분만 사용해 서버와 브라우저의 시간대와 관계없이 같은 날짜를 표시합니다.
// 날짜가 없는 이전 자료도 서버 렌더링이 중단되지 않도록 빈 값을 허용합니다.
const dateLabel = (iso?: string) => {
  const [y, m, d] = (iso || '').slice(0, 10).split('-').map(Number)
  return y && m && d ? `${y}년 ${m}월 ${d}일` : ''
}
// 서버에서 공개 업체만 받은 뒤 검색·페이지를 URL 쿼리로 유지해 직접 공유와 새로고침을 지원합니다.
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
          // 검색로봇이 2페이지 이후의 상세페이지까지 따라가도록 버튼 대신 실제 링크를 씁니다.
          <nav className="company-pagination" aria-label="업체 목록 페이지">
            {page > 1 ? (
              <Link className="icon-button" aria-label="이전 페이지" rel="prev" to={pageLink(q, page - 1)}>
                <ChevronLeft size={20} />
              </Link>
            ) : (
              <span className="icon-button is-disabled" aria-hidden="true">
                <ChevronLeft size={20} />
              </span>
            )}
            <span>
              {page} / {pages}
            </span>
            {page < pages ? (
              <Link className="icon-button" aria-label="다음 페이지" rel="next" to={pageLink(q, page + 1)}>
                <ChevronRight size={20} />
              </Link>
            ) : (
              <span className="icon-button is-disabled" aria-hidden="true">
                <ChevronRight size={20} />
              </span>
            )}
          </nav>
        )}
      </section>
      <ContactBanner />
    </>
  )
}
// SSR 상세 데이터를 먼저 쓰고 API로 갱신합니다. 내부 검색에서 숨긴 업체도 직접 주소로 조회합니다.
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
          document.title = fullTitle(companyTitle(value))
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
  // 같은 유형을 먼저 보여주는 다른 공개 업체입니다. 상세페이지끼리 연결되어 검색로봇이 더 많은 업체를 찾습니다.
  const related = companies
    .filter((c) => c.id !== item.id)
    .sort((a, b) => Number(b.service === item.service) - Number(a.service === item.service))
    .slice(0, 4)
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
          {dateLabel(item.updatedAt || item.createdAt) && (
            <p className="company-updated">
              최종 업데이트{' '}
              <time dateTime={item.updatedAt || item.createdAt}>
                {dateLabel(item.updatedAt || item.createdAt)}
              </time>
            </p>
          )}
        </div>
      </section>
      <section className="container company-cta-banner" aria-labelledby="company-cta-title">
        <div className="company-cta-copy">
          <p className="eyebrow">CONSULTATION</p>
          <h2 id="company-cta-title">비슷한 상황을 겪고 계신가요?</h2>
          <p>현재 상황과 자료를 함께 살펴보겠습니다.</p>
        </div>
        <div className="company-cta-actions">
          <Link className="button lime" to={`/consultation?company=${encodeURIComponent(item.name)}`}>
            피해 사실 상담하기
            <ArrowRight size={18} />
          </Link>
          <a className="button company-cta-phone" href={`tel:${settings.phone}`}>
            <Phone size={18} />
            {settings.phone}
          </a>
          {settings.kakaoUrl && (
            <a className="button kakao" href={settings.kakaoUrl} target="_blank" rel="noreferrer">
              <KakaoIcon />
              카카오톡으로 문의하기
            </a>
          )}
        </div>
      </section>
      {item.document && hasDocumentContent(item.document) ? (
        <section className="container company-rich-section" aria-label="업체 상세 본문">
          <CompanyDocumentView document={item.document} />
        </section>
      ) : null}
      {related.length > 0 && (
        <section className="container company-related" aria-labelledby="company-related-title">
          <h2 id="company-related-title">다른 업체 정보</h2>
          <CompanyCards items={related} />
        </section>
      )}
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
