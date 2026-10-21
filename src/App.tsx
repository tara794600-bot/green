import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import { ContentContext, useContent } from './lib/content-context'
import { api } from './lib/api'
import type { PublicData } from './lib/types'
import { pageMeta } from '../shared/seo.mjs'
const PublicPages = lazy(() => import('./pages/PublicPages'))
const Consultation = lazy(() => import('./pages/Consultation'))
const Admin = lazy(() => import('./pages/Admin'))
const Landing = lazy(() => import('./pages/Landing'))
// SPA 내부 이동에서도 서버 HTML과 같은 제목·설명·색인 규칙을 유지합니다. 계산은 shared/seo.mjs가 담당합니다.
function Metadata() {
  const { pathname, search } = useLocation()
  const content = useContent()
  const [initialPath] = useState(pathname + search)
  useEffect(() => {
    const meta = pageMeta(pathname, search, content)
    document.title = meta.title
    for (const [selector, value] of [
      ['meta[name="robots"]', meta.robots],
      ['meta[name="description"]', meta.description],
      ['meta[property="og:title"]', meta.title],
      ['meta[property="og:description"]', meta.description],
    ])
      document.querySelector(selector)?.setAttribute('content', value)
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical && meta.canonicalPath) canonical.href = new URL(meta.canonicalPath, canonical.href).href
    // 구조화 데이터는 서버가 첫 화면에만 넣습니다. 다른 페이지로 이동하면 이전 페이지 정보를 지웁니다.
    if (pathname + search !== initialPath)
      document.querySelectorAll('script[type="application/ld+json"][data-seo]').forEach((el) => el.remove())
  }, [pathname, search, content, initialPath])
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
