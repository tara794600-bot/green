import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Phone,
  Search,
  Clock,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useContent } from '../lib/content-context'
import { ArticleCard, ArrowLink, Checklist, EmptyState, PageHero } from '../components/ui'
import { ContactBanner } from '../components/Layout'
import type { Article, ArticleKind } from '../lib/types'
import Companies from './Companies'

// 상세 ID뿐 아니라 콘텐츠 종류도 검사해 다른 종류의 URL에서 글이 잘못 표시되지 않게 합니다.
export default function PublicPages() {
  const { pathname } = useLocation(),
    { articles } = useContent()
  const [root, id] = pathname.split('/').filter(Boolean)
  if (root === 'companies') return <Companies id={id} />
  if (root === 'about') return <About />
  if (root === 'faq') return <Faq />
  if (root === 'contact') return <Contact />
  if (root === 'privacy') return <Privacy />
  const kind: Record<string, ArticleKind> = {
    practice: 'practice',
    cases: 'case',
    guides: 'guide',
    lawyers: 'lawyer',
  }
  if (kind[root]) {
    if (id) {
      const article = articles.find((a) => a.id === id && a.kind === kind[root])
      return article ? <ArticleDetail key={article.id} article={article} /> : <NotFound />
    }
    return <Library key={root} kind={kind[root]} />
  }
  return <NotFound />
}
function About() {
  return (
    <>
      <PageHero
        eyebrow="ABOUT NARAN"
        title={'사건을 이해하는 일은,\n당신의 이야기를 듣는 일부터.'}
        description="당신의 상황을 충분히 듣고, 필요한 대응의 방향을 함께 찾습니다."
      />
      <section className="section container about-intro">
        <div>
          <p className="eyebrow">THE NARAN PROMISE</p>
          <h2>
            법률의 언어보다 먼저,
            <br />
            당신의 이야기를 듣습니다.
          </h2>
        </div>
        <div>
          <p>
            어디서부터 이야기해야 할지 막막한 순간이 있습니다. 나란은 그 마음을 이해하는 것에서 시작합니다.
          </p>
          <p>
            확인된 사실과 아직 확인이 필요한 내용을 나누고, 지금 살펴볼 수 있는 선택지를 차분히 설명합니다.
            사건의 진행뿐 아니라 그 너머의 일상까지 생각하겠습니다.
          </p>
          <ArrowLink to="/lawyers">담당 변호사 만나기</ArrowLink>
        </div>
      </section>
      <section className="section sage">
        <div className="container">
          <p className="eyebrow">OUR PRINCIPLES</p>
          <h2>나란이 지키는 세 가지 약속.</h2>
          <div className="principle-grid">
            {[
              ['01', '충분히 듣겠습니다.', '사건의 경위와 현재의 어려움, 마음에 남은 질문을 함께 듣습니다.'],
              [
                '02',
                '명확하게 설명하겠습니다.',
                '가능한 대응과 검토가 필요한 부분을 구분하고, 이해할 수 있는 말로 설명합니다.',
              ],
              [
                '03',
                '나란히 걷겠습니다.',
                '진행 범위와 다음 단계를 함께 확인하며 필요한 대응을 차근차근 준비합니다.',
              ],
            ].map(([n, title, description]) => (
              <div key={n}>
                <span className="serif-number">{n}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ContactBanner />
    </>
  )
}
const libraryInfo = {
  practice: {
    eyebrow: 'AREAS OF PRACTICE',
    title: '당신의 상황에서\n대응의 출발점을 찾습니다.',
    description: '어떤 일인지 정확히 설명하기 어려워도 괜찮습니다. 지금의 상황과 가까운 분야부터 살펴보세요.',
  },
  case: {
    eyebrow: 'CASE LIBRARY',
    title: '비슷한 상황을 통해,\n내 사건의 질문을 찾습니다.',
    description:
      '상담에서 확인할 쟁점과 준비 자료를 살펴보세요. 모든 사례는 상담 준비를 위한 가상 예시입니다.',
  },
  guide: {
    eyebrow: 'NEWS & INSIGHTS',
    title: '다음 한 걸음을 위한\n나란의 안내.',
    description: '상담 준비부터 진행 과정까지, 당신에게 필요한 정보를 차분히 전합니다.',
  },
  lawyer: {
    eyebrow: 'OUR ATTORNEYS',
    title: '당신의 이야기를 듣는,\n나란의 변호사.',
    description: '사건의 맥락을 이해하고 대응의 방향을 함께 찾겠습니다.',
  },
  faq: { eyebrow: 'FAQ', title: '자주 묻는 질문', description: '' },
}
function Library({ kind }: { kind: ArticleKind }) {
  const { articles } = useContent(),
    [params, setParams] = useSearchParams()
  const q = params.get('q') || '',
    category = params.get('category') || '전체',
    page = Math.max(1, Number(params.get('page')) || 1)
  const all = articles.filter((a) => a.kind === kind),
    categories = ['전체', ...new Set(all.map((a) => a.category))]
  const filtered = all.filter(
    (a) =>
      (category === '전체' || a.category === category) &&
      `${a.title} ${a.excerpt} ${a.body}`.toLowerCase().includes(q.toLowerCase()),
  )
  const pages = Math.ceil(filtered.length / 9),
    current = Math.min(page, Math.max(pages, 1)),
    visible = filtered.slice((current - 1) * 9, current * 9)
  // 검색·분류를 바꾸면 이전 페이지 번호를 버려 결과가 있어도 빈 화면이 나오는 것을 방지합니다.
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  return (
    <>
      <PageHero {...libraryInfo[kind]} />
      <section className="section container">
        {kind === 'case' || kind === 'guide' ? (
          <>
            <div className="library-toolbar">
              <div className="filter-tabs" aria-label="분야 필터">
                {categories.map((c) => (
                  <button
                    key={c}
                    className={category === c ? 'active' : ''}
                    onClick={() => change('category', c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <label className="search-box">
                <Search size={18} />
                <input
                  aria-label="콘텐츠 검색"
                  value={q}
                  onChange={(e) => change('q', e.target.value)}
                  placeholder="궁금한 내용을 검색하세요"
                />
              </label>
            </div>
            <p className="result-count">
              전체 <strong>{filtered.length}</strong>건
            </p>
          </>
        ) : null}
        {kind === 'lawyer' ? (
          <div className="lawyer-grid">
            {all.map((a) => (
              <Link className="lawyer-card" key={a.id} to={`/lawyers/${a.id}`}>
                <div className="lawyer-photo">
                  <img src={a.image} alt={a.title} />
                </div>
                <span>{a.category}</span>
                <h2>
                  {a.title}
                  <ArrowUpRight size={23} />
                </h2>
                <p>{a.excerpt}</p>
              </Link>
            ))}
          </div>
        ) : visible.length ? (
          <div className={`card-grid ${kind === 'practice' ? 'practice-grid' : ''}`}>
            {visible.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                index={kind === 'practice' ? index : undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="검색 결과가 없습니다."
            description="다른 단어로 검색하거나 분야 필터를 바꿔보세요."
          >
            <button className="button outline" onClick={() => setParams({})}>
              전체 보기
            </button>
          </EmptyState>
        )}
        {pages > 1 && (
          <nav className="pagination" aria-label="페이지 선택">
            <button
              disabled={current === 1}
              onClick={() => change('page', String(current - 1))}
              aria-label="이전 페이지"
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: pages }, (_, i) => (
              <button
                className={current === i + 1 ? 'active' : ''}
                key={i}
                onClick={() => change('page', String(i + 1))}
                aria-current={current === i + 1 ? 'page' : undefined}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={current === pages}
              onClick={() => change('page', String(current + 1))}
              aria-label="다음 페이지"
            >
              <ChevronRight size={18} />
            </button>
          </nav>
        )}
      </section>
      <ContactBanner />
    </>
  )
}
function ArticleDetail({ article: a }: { article: Article }) {
  const { articles } = useContent(),
    info = libraryInfo[a.kind]
  const path = { practice: '/practice', case: '/cases', guide: '/guides', faq: '/faq', lawyer: '/lawyers' }[
    a.kind
  ]
  useEffect(() => {
    document.title = `${a.title} | 법무법인 나란`
  }, [a.title])
  const related = articles
    .filter((item) => item.id !== a.id && item.kind === 'case' && item.category === a.category)
    .slice(0, 3)
  const next = articles.filter((item) => item.kind === a.kind)[
    articles.filter((item) => item.kind === a.kind).findIndex((item) => item.id === a.id) + 1
  ]
  return (
    <>
      <PageHero
        eyebrow={a.kind === 'case' ? 'CASE NOTE' : info.eyebrow}
        title={a.title}
        description={a.excerpt}
        parent={{
          title:
            a.kind === 'case'
              ? '사례 안내'
              : a.kind === 'practice'
                ? '업무 분야'
                : a.kind === 'lawyer'
                  ? '담당 변호사'
                  : '소식·가이드',
          path,
        }}
      />
      {a.kind === 'lawyer' ? (
        <section className="section container lawyer-detail">
          <div className="lawyer-photo">
            <img src={a.image} alt={a.title} />
          </div>
          <div>
            <p className="eyebrow">NARAN LAW FIRM</p>
            <h2>
              경력과 업무를
              <br />
              명확하게 소개합니다.
            </h2>
            <p>{a.body}</p>
            <Checklist items={a.checks} />
            <Link className="button" to="/consultation">
              상담 문의
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      ) : (
        <article className="article-body container narrow">
          {a.kind === 'case' && (
            <>
              <p className="eyebrow">{a.category} · 가상 예시</p>
              <h2>상황의 흐름</h2>
              <p>{a.excerpt}</p>
              <ol className="flow-list">
                {a.flow.map((f, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {f}
                  </li>
                ))}
              </ol>
            </>
          )}
          {a.kind === 'guide' ? (
            <>
              <p className="eyebrow">상담 준비 가이드 · NARAN INSIGHTS</p>
              {a.body.split('\n\n').map((p, i) => (
                <p key={i} className="article-paragraph">
                  {p}
                </p>
              ))}
              <h2>상담 전, 함께 확인해 주세요.</h2>
            </>
          ) : (
            <h2>{a.kind === 'case' ? '상담에서 확인할 쟁점' : '먼저 확인할 내용'}</h2>
          )}
          <Checklist items={a.checks} />
          {a.image && (
            <figure className="article-image">
              <img src={a.image} alt="상담 자료 검토" loading="lazy" />
              <figcaption>하나씩 정리하며, 다음 한 걸음을 함께 찾습니다.</figcaption>
            </figure>
          )}
          {a.materials.length > 0 && (
            <>
              <h2>{a.kind === 'case' ? '보유하고 있다면 함께 준비하세요.' : '준비하면 도움이 되는 자료'}</h2>
              <Checklist items={a.materials} />
              <p className="muted">
                모든 자료를 갖춰야만 상담할 수 있는 것은 아닙니다. 현재 상황과 보유 자료부터 알려주세요.
              </p>
            </>
          )}
          {a.kind !== 'guide' && (
            <>
              <h2>{a.kind === 'case' ? '검토 후 안내하는 내용' : '상담은 이렇게 진행합니다.'}</h2>
              <p>{a.body}</p>
            </>
          )}
          <Link className="button" to={`/consultation?category=${encodeURIComponent(a.category)}`}>
            이 상황 상담 문의
            <ArrowRight size={16} />
          </Link>
          <div className="article-navigation">
            <ArrowLink to={path}>목록으로</ArrowLink>
            {next && (
              <ArrowLink to={`${path}/${next.id}`}>다음 {a.kind === 'case' ? '사례' : '글'}</ArrowLink>
            )}
          </div>
        </article>
      )}
      {related.length > 0 && (
        <section className="section sage">
          <div className="container">
            <h2>비슷한 상황 살펴보기</h2>
            <div className="card-grid">
              {related.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}
      <ContactBanner />
    </>
  )
}
function Faq() {
  const { articles } = useContent(),
    [search, setSearch] = useState(''),
    faqs = articles.filter((a) => a.kind === 'faq' && `${a.title} ${a.body}`.includes(search))
  return (
    <>
      <PageHero
        eyebrow="QUESTIONS & ANSWERS"
        title={'상담을 앞두고\n마음에 걸리는 질문들.'}
        description="처음 상담하는 분들이 자주 묻는 내용을 모았습니다."
      />
      <section className="section container narrow">
        <label className="search-box faq-search">
          <Search size={18} />
          <input
            aria-label="질문 검색"
            placeholder="궁금한 질문을 검색하세요"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="faq-list">
          {faqs.map((f) => (
            <details key={f.id}>
              <summary>
                {f.title}
                <span>+</span>
              </summary>
              <p>{f.body}</p>
            </details>
          ))}
        </div>
        {!faqs.length && (
          <EmptyState
            title="일치하는 질문이 없습니다."
            description="다른 검색어를 입력하거나 직접 상담을 문의해 주세요."
          />
        )}
      </section>
      <ContactBanner />
    </>
  )
}
function Contact() {
  const { settings: s } = useContent()
  return (
    <>
      <PageHero
        eyebrow="VISIT NARAN"
        title="나란을 만나는 방법."
        description="방문 전 연락주시면 상담 일정과 찾아오시는 길을 안내해 드립니다."
      />
      <section className="section container contact-grid">
        <div className="address-visual">
          <MapPin size={43} strokeWidth={1} />
          <p className="eyebrow">NARAN LAW FIRM</p>
          <h2>
            당신의 내일에,
            <br />
            나란히.
          </h2>
          <span>{s.address}</span>
          <a
            target="_blank"
            rel="noreferrer"
            className="button"
            href={`https://map.naver.com/p/search/${encodeURIComponent(s.address)}`}
          >
            네이버 지도로 보기
            <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="contact-information">
          <h2>법무법인 나란</h2>
          <div>
            <MapPin size={19} />
            <section>
              <h3>찾아오시는 길</h3>
              <p>본사무소 · {s.address}</p>
              <p>분사무소 · {s.branchAddress}</p>
            </section>
          </div>
          <div>
            <Phone size={19} />
            <section>
              <h3>상담 전화</h3>
              <a className="contact-phone" href={`tel:${s.phone}`}>
                {s.phone}
              </a>
            </section>
          </div>
          <div>
            <Clock size={19} />
            <section>
              <h3>상담 안내</h3>
              <p>{s.hours}</p>
            </section>
          </div>
          {s.kakaoUrl && (
            <div>
              <MessageCircle size={19} />
              <section>
                <h3>카카오톡 문의</h3>
                <a href={s.kakaoUrl} target="_blank" rel="noreferrer">
                  나란 카카오톡 채널
                  <ArrowUpRight size={15} />
                </a>
              </section>
            </div>
          )}
        </div>
      </section>
      <ContactBanner />
    </>
  )
}
function Privacy() {
  const { settings } = useContent()
  return (
    <>
      <PageHero
        eyebrow="PRIVACY POLICY"
        title="개인정보 처리 안내"
        description="상담 신청에 필요한 정보를 아래와 같이 처리합니다."
      />
      <article className="article-body container narrow legal-copy">
        <p>
          개인정보처리자: {settings.name} · 문의: {settings.phone}
        </p>
        <h2>1. 수집 항목과 이용 목적</h2>
        <p>
          상담 신청 시 성함, 연락처, 상담 분야, 개인정보 수집·이용 동의 기록을 수집합니다. 현재 상황과 연락
          가능 시간은 선택 항목입니다. 접수 확인, 상담 연락, 상담 일정 조율 및 신청 이력 관리에 이용합니다.
          상담 신청 경로를 확인하기 위해 최초 방문 주소, 검색·광고 키워드, 이전 페이지와 유입 정보를 함께
          기록합니다.
        </p>
        <h2>2. 보관과 삭제</h2>
        <p>
          상담 처리에 필요한 기간 동안 보관하며, 이용 목적을 달성하거나 삭제 요청이 있는 경우 담당자가 확인 후
          삭제합니다. 별도 사건 위임이 이루어진 경우에는 해당 업무에 적용되는 보관 기준을 안내합니다.
        </p>
        <h2>3. 상담 시스템</h2>
        <p>
          운영 설정에 따라 Firebase에 접수 정보를 저장하고, Google Sheets에 상담 관리 기록을 동기화하며,
          Telegram으로 담당자에게 접수를 알립니다. 전송되는 항목은 성함, 연락처, 상담 분야, 상담 내용, 연락
          가능 시간 및 접수 정보입니다. 연동 서비스에 저장된 정보의 삭제도 담당자를 통해 요청할 수 있습니다.
        </p>
        <h2>4. 정보주체의 요청</h2>
        <p>
          개인정보 열람·정정·삭제 및 처리 정지는 대표전화 {settings.phone}로 요청하실 수 있습니다. 본인 확인
          후 처리 결과를 안내합니다.
        </p>
        <h2>5. 동의를 거부할 권리</h2>
        <p>
          개인정보 수집·이용에 동의하지 않을 수 있습니다. 다만 온라인 상담 신청에 필요한 연락 정보를 처리할 수
          없어 온라인 접수가 제한됩니다. 전화 문의를 이용하실 수 있습니다.
        </p>
        <ArrowLink to="/consultation">상담 신청으로 돌아가기</ArrowLink>
      </article>
    </>
  )
}
function NotFound() {
  return (
    <section className="section container not-found">
      <p className="eyebrow">404 · PAGE NOT FOUND</p>
      <h1>찾으시는 페이지가 없습니다.</h1>
      <p>주소가 변경되었거나 공개되지 않은 페이지입니다.</p>
      <Link className="button" to="/">
        홈으로 돌아가기
        <ArrowRight size={17} />
      </Link>
    </section>
  )
}
