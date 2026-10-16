import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, Phone, ArrowUp } from 'lucide-react'
import { useContent } from '../lib/content-context'
import { Modal } from './ui'
import { captureVisit } from '../lib/attribution'
import { useScrollReveal } from '../lib/use-scroll-reveal'

const navigation = [
  {
    path: '/about',
    title: '나란 소개',
    sub: [
      ['/about', '나란의 약속'],
      ['/lawyers', '담당 변호사'],
    ],
  },
  { path: '/practice', title: '업무 분야', sub: [['/practice', '피해 유형 전체 보기']] },
  { path: '/cases', title: '사례 안내', sub: [['/cases', '상황별 사례 살펴보기']] },
  { path: '/companies', title: '사기업체 정보', sub: [['/companies', '업체 정보 검색']] },
  {
    path: '/guides',
    title: '소식·가이드',
    sub: [
      ['/guides', '상담 준비 가이드'],
      ['/faq', '자주 묻는 질문'],
      ['/contact', '오시는 길'],
    ],
  },
]
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="나란 홈">
      <span className="wordmark">나란</span>
      <span className="brand-detail">
        법무법인 나란<small>NARAN LAW FIRM</small>
      </span>
    </Link>
  )
}
export function ContactBanner() {
  const { settings } = useContent()
  return (
    <section className="contact-banner">
      <div className="container banner-inner" data-reveal-group>
        <div>
          <p className="eyebrow">WE ARE HERE WITH YOU</p>
          <h2>
            다음 한 걸음,
            <br />
            나란과 함께 이야기하세요.
          </h2>
        </div>
        <div className="banner-contact">
          <a className="phone-display" href={`tel:${settings.phone}`}>
            {settings.phone}
          </a>
          <Link className="button lime" to="/consultation">
            상담 신청
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  )
}
export default function Layout() {
  const [menu, setMenu] = useState(false),
    { pathname, hash } = useLocation(),
    { settings, powerlinkPrefix } = useContent()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    // 공개 경로 이동마다 확인하되 최초 유입 유지·새 캠페인 판정은 captureVisit 내부에서 처리합니다.
    captureVisit(powerlinkPrefix)
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash, powerlinkPrefix])
  useScrollReveal(main, pathname)
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="주 메뉴">
            {navigation.map((n) => (
              <NavLink key={n.path} to={n.path}>
                {n.title}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <Link
              className="button header-consult"
              to={pathname === '/consultation' ? '#consultation-form' : '/consultation'}
            >
              상담 신청
              <ArrowRight size={15} />
            </Link>
            <button
              className="icon-button menu-toggle"
              aria-label="전체 메뉴 열기"
              onClick={() => setMenu(true)}
            >
              <Menu size={25} />
            </button>
          </div>
        </div>
      </header>
      {menu && (
        <Modal title="전체 메뉴" onClose={() => setMenu(false)}>
          <nav className="menu-grid" aria-label="전체 메뉴">
            {navigation.map((n) => (
              <div key={n.path}>
                <Link to={n.path} onClick={() => setMenu(false)}>
                  {n.title}
                  <ArrowRight size={20} />
                </Link>
                {n.sub.map(([path, title]) => (
                  <Link key={path} to={path} onClick={() => setMenu(false)}>
                    {title}
                  </Link>
                ))}
              </div>
            ))}
            <Link className="button" to="/consultation" onClick={() => setMenu(false)}>
              상담 신청
              <ArrowRight size={18} />
            </Link>
          </nav>
        </Modal>
      )}
      <main id="main-content" ref={main}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-top">
            <div>
              <Brand />
              <p className="footer-motto">당신의 내일에, 나란히.</p>
            </div>
            <nav aria-label="하단 메뉴">
              <Link to="/faq">자주 묻는 질문</Link>
              <Link to="/contact">오시는 길</Link>
              <Link to="/privacy">개인정보 처리 안내</Link>
            </nav>
            <button
              className="back-top"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="맨 위로"
            >
              <ArrowUp size={19} />
            </button>
          </div>
          <div className="footer-bottom">
            <p>
              {settings.name} · 대표 {settings.representative} · 사업자등록번호 {settings.businessNumber}
              <br />
              본사무소 {settings.address}
              <br />
              분사무소 {settings.branchAddress} · 대표전화{' '}
              <a href={`tel:${settings.phone}`}>{settings.phone}</a>
            </p>
            <span>
              © {new Date().getFullYear()} NARAN LAW FIRM. ALL RIGHTS RESERVED.<Link to="/admin">관리자</Link>
            </span>
          </div>
        </div>
      </footer>
      <div className="mobile-contact">
        <a href={`tel:${settings.phone}`}>
          <Phone size={17} />
          전화 문의
        </a>
        <Link to={pathname === '/consultation' ? '#consultation-form' : '/consultation'}>
          상담 신청
          <ArrowRight size={17} />
        </Link>
      </div>
    </>
  )
}
