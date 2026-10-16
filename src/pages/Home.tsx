import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { useContent } from '../lib/content-context'
import { ArticleCard, ArrowLink, Checklist } from '../components/ui'
import { ContactBanner } from '../components/Layout'
import RollingShowcase from '../components/RollingShowcase'
import { CompanyCards } from './Companies'
import type { LandingData } from '../lib/types'
import heroImage from '../assets/hero-consultation.webp'

// 일반 홈과 광고 랜딩이 같은 화면을 공유하며, landing이 있으면 키워드와 관련 업체를 추가합니다.
export default function Home({ landing }: { landing?: LandingData | null }) {
  const { articles, settings, rollingCases = [] } = useContent(),
    practices = articles.filter((a) => a.kind === 'practice'),
    guides = articles.filter((a) => a.kind === 'guide'),
    faqs = articles.filter((a) => a.kind === 'faq'),
    cases = articles.filter((a) => a.kind === 'case')
  return (
    <>
      <section className="home-hero container">
        <div className="hero-copy" data-reveal-group>
          <p className="eyebrow">NARAN · FINANCIAL FRAUD COUNSEL</p>
          {landing && <p className="landing-keyword">{landing.keyword}</p>}
          <h1>{settings.heroTitle}</h1>
          <p className="hero-description">{settings.heroDescription}</p>
          <Link className="button" to="/consultation">
            내 상황 상담하기
            <ArrowRight size={17} />
          </Link>
          <a className="hero-phone" href={`tel:${settings.phone}`}>
            {settings.phone}
            <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="hero-visual" data-reveal="zoom" data-reveal-delay="160">
          <img
            src={heroImage}
            alt="의뢰인의 이야기를 듣고 서류를 함께 살펴보는 법률 상담 모습"
            fetchPriority="high"
          />
        </div>
      </section>
      <div className="container quick-links" data-reveal-group>
        <Link to="/practice">
          <span>01</span>피해 유형부터 확인하기
          <ArrowUpRight size={17} />
        </Link>
        <Link to="/cases">
          <span>02</span>비슷한 상황 살펴보기
          <ArrowUpRight size={17} />
        </Link>
        <Link to="/guides">
          <span>03</span>상담 준비 알아보기
          <ArrowUpRight size={17} />
        </Link>
      </div>
      {landing && landing.companies.length > 0 && (
        <section className="section container landing-results">
          <p className="eyebrow" data-reveal>
            RELATED INFORMATION
          </p>
          <div className="section-heading" data-reveal>
            <h2>“{landing.keyword}” 관련 정보</h2>
            <ArrowLink to="/companies">업체 정보 전체 보기</ArrowLink>
          </div>
          <CompanyCards items={landing.companies} />
        </section>
      )}
      <RollingShowcase items={rollingCases} />
      <section className="section container">
        <p className="eyebrow" data-reveal>
          01 · AREAS OF PRACTICE
        </p>
        <div className="section-heading" data-reveal>
          <h2>어떤 상황을 겪고 계신가요?</h2>
          <span className="muted">지금의 상황에서, 대응의 출발점을 찾습니다.</span>
        </div>
        <div className="card-grid practice-grid" data-reveal-group>
          {practices.map((article, index) => (
            <ArticleCard key={article.id} article={article} index={index} />
          ))}
        </div>
        <ArrowLink to="/practice">업무 분야 전체 보기</ArrowLink>
      </section>
      <section className="section sage">
        <div className="container promise-grid">
          <div className="promise-visual" data-reveal="left">
            <img src="/images/consultation.webp" alt="상담 자료를 함께 살펴보는 모습" loading="lazy" />
            <div className="promise-quote">
              듣는 것에서 시작해,
              <br />
              함께 걷는 법률.
            </div>
            <span>NARAN LAW FIRM</span>
          </div>
          <div className="promise-copy" data-reveal="right" data-reveal-delay="120">
            <p className="eyebrow">02 · THE NARAN PROMISE</p>
            <h2>
              사건 너머의 일상까지
              <br />
              생각합니다.
            </h2>
            <p>
              불안은 덜고, 방향은 선명하게.
              <br />
              복잡한 상황을 함께 짚어 갑니다. 나란이 지향하는 법률 상담의 방식입니다.
            </p>
            <Checklist
              items={[
                '불안한 마음까지 충분히 듣겠습니다.',
                '가능성과 한계를 함께 설명하겠습니다.',
                '필요한 대응을 차근차근 안내하겠습니다.',
              ]}
            />
            <Link className="button" to="/about">
              나란 소개 보기
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section container">
        <p className="eyebrow" data-reveal>
          03 · CASE LIBRARY
        </p>
        <div className="section-heading" data-reveal>
          <h2>
            상황은 달라도,
            <br />
            확인할 질문은 있습니다.
          </h2>
          <p className="muted">가상 예시 · 실제 수임 실적이나 결과가 아닙니다.</p>
        </div>
        <div className="card-grid" data-reveal-group>
          {[cases[0], cases[5], cases[10]].filter(Boolean).map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
        <ArrowLink to="/cases">사례 안내 전체 보기</ArrowLink>
      </section>
      <section className="section sage">
        <div className="container">
          <p className="eyebrow" data-reveal>
            04 · NEWS & INSIGHTS
          </p>
          <h2 data-reveal>상담을 준비하는 당신에게.</h2>
          <div className="card-grid" data-reveal-group>
            {guides.slice(0, 3).map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <ArrowLink to="/guides">소식·가이드 전체 보기</ArrowLink>
        </div>
      </section>
      <section className="section container faq-section">
        <p className="eyebrow" data-reveal>
          BEFORE WE MEET
        </p>
        <h2 data-reveal>상담 전, 궁금한 점부터.</h2>
        <div className="faq-list" data-reveal-group>
          {faqs.slice(0, 3).map((f, i) => (
            <details key={f.id} open={i === 0}>
              <summary>
                {f.title}
                <span>+</span>
              </summary>
              <p>{f.body}</p>
            </details>
          ))}
        </div>
        <ArrowLink to="/faq">질문 전체 보기</ArrowLink>
      </section>
      <ContactBanner />
    </>
  )
}
