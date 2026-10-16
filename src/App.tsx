import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import { ContentContext, useContent } from './lib/content-context'
import { api } from './lib/api'
import type { PublicData } from './lib/types'
const PublicPages = lazy(() => import('./pages/PublicPages'))
const Consultation = lazy(() => import('./pages/Consultation'))
const Admin = lazy(() => import('./pages/Admin'))
const Landing = lazy(() => import('./pages/Landing'))
// SPA 내부 이동의 제목·검색 설정을 갱신합니다. 초기 HTML의 메타정보는 server/render.mjs가 담당합니다.
function Metadata() {
  const { pathname } = useLocation()
  const { articles, companies, selectedCompany, powerlinkPrefix, landing } = useContent()
  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]')
    meta?.setAttribute(
      'content',
      pathname.startsWith('/admin') || pathname.startsWith(powerlinkPrefix || '/p/')
        ? 'noindex, nofollow'
        : 'index, follow',
    )
    const names: Record<string, string> = {
      '/': '당신의 회복에, 법률로 나란히.',
      '/about': '나란 소개',
      '/practice': '업무 분야',
      '/cases': '사례 안내',
      '/guides': '소식·가이드',
      '/faq': '자주 묻는 질문',
      '/consultation': '상담 신청',
      '/contact': '오시는 길',
      '/privacy': '개인정보 처리 안내',
      '/lawyers': '담당 변호사',
      '/companies': '사기업체 정보',
    }
    const [root, id] = pathname.split('/').filter(Boolean)
    const article = articles.find((a) => a.id === id)
    const company =
      root === 'companies'
        ? selectedCompany?.id === id
          ? selectedCompany
          : companies?.find((c) => c.id === id)
        : null
    document.title = `${names[pathname] || company?.name || article?.title || (pathname.startsWith(powerlinkPrefix || '/p/') ? landing?.keyword || '나란 상담 안내' : pathname.startsWith('/admin') ? '관리자' : '상세 안내')} | 법무법인 나란`
  }, [pathname, articles, companies, selectedCompany, powerlinkPrefix, landing])
  return null
}
class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-state">
        <h1>화면을 불러오지 못했습니다.</h1>
        <p>잠시 후 새로고침해 주세요.</p>
        <button className="button" onClick={() => location.reload()}>
          새로고침
        </button>
      </div>
    ) : (
      this.props.children
    )
  }
}
// 서버가 주입한 공개 데이터로 첫 화면을 맞춘 뒤 API로 갱신해 hydration 불일치를 줄입니다.
export default function App() {
  const [content, setContent] = useState<PublicData | null>(() => {
      try {
        return JSON.parse(document.getElementById('naran-bootstrap')?.textContent || 'null')
      } catch {
        return null
      }
    }),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = () =>
      api<PublicData>('/content?path=' + encodeURIComponent(window.location.pathname))
        .then((data) => {
          if (active) {
            setContent(data)
            setFailed(false)
          }
        })
        .catch(() => {
          if (active) setFailed(true)
        })
    void refresh()
    window.addEventListener('focus', refresh)
    // 관리자 저장 후 같은 앱의 공개 콘텐츠도 다시 읽도록 하는 내부 이벤트입니다.
    window.addEventListener('content-updated', refresh)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener('content-updated', refresh)
    }
  }, [])
  if (!content)
    return (
      <div className="loading-screen">
        <span className="wordmark">나란</span>
        <p>
          {failed ? '사이트에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' : '화면을 준비하고 있습니다.'}
        </p>
        {failed && (
          <button className="button" onClick={() => location.reload()}>
            다시 시도
          </button>
        )}
      </div>
    )
  return (
    <AppBoundary>
      <ContentContext value={content}>
        <BrowserRouter>
          <Metadata />
          <Suspense
            fallback={
              <div className="loading-screen">
                <span className="wordmark">나란</span>
                <p>화면을 준비하고 있습니다.</p>
              </div>
            }
          >
            <Routes>
              <Route path="/admin/*" element={<Admin />} />
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="consultation" element={<Consultation />} />
                <Route path={`${content.powerlinkPrefix || '/p/'}:token`} element={<Landing />} />
                <Route path="*" element={<PublicPages />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ContentContext>
    </AppBoundary>
  )
}
